import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withRegistryOnlyProxy } from "./npm-registry-proxy";

export type ExtensionDependencyInstallResult =
  | { state: "skipped"; reason: "no-package-json" | "no-dependencies" }
  | { state: "installed" }
  | { state: "failed"; error: string };

/** Injectable so tests never run npm. Resolves with the exit code and captured stderr. */
export type DependencyCommandRunner = (
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  envOverrides?: Record<string, string>,
) => Promise<{ code: number; stderr: string }>;

const NPM_INSTALL_TIMEOUT_MS = 120_000;
/** npm output is not toast-shaped; the tail carries the actual failure. */
const DEPENDENCY_ERROR_TAIL_CHARS = 200;
/** Rolling cap so a chatty npm cannot balloon the main process's memory. */
const DEPENDENCY_STDERR_KEEP_CHARS = 8192;
const PUBLIC_NPM_REGISTRY = "https://registry.npmjs.org/";
const NPM_LOCKFILE_NAMES = ["package-lock.json", "npm-shrinkwrap.json"] as const;
const NON_NPM_LOCKFILE_NAMES = ["yarn.lock", "pnpm-lock.yaml"] as const;
const LOCKFILE_DEPENDENCY_FIELDS = new Set([
  "dependencies",
  "optionalDependencies",
  "devDependencies",
  "peerDependencies",
]);

function dependencyErrorTail(text: string): string {
  return text.length > DEPENDENCY_ERROR_TAIL_CHARS
    ? `…${text.slice(-DEPENDENCY_ERROR_TAIL_CHARS)}`
    : text;
}

function dependencyRunnerError(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    return "npm is not available on PATH; install Node.js/npm before importing dependencies";
  }
  return error instanceof Error ? error.message : String(error);
}

function isRegistryDependencySpec(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const spec = value.trim();
  // Registry versions and ranges contain no URL/path separators or scheme
  // delimiter. This also rejects npm aliases and workspace/local specs.
  return spec.length > 0 && !/[\\/:]/.test(spec);
}

function dependencyMapError(field: string, value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return `${field} must be a JSON object`;
  }
  for (const [name, spec] of Object.entries(value as Record<string, unknown>)) {
    if (!isRegistryDependencySpec(spec)) {
      return dependencyErrorTail(`dependency ${name} in ${field} uses a non-registry spec (${String(spec)}); only registry versions are installable`);
    }
  }
  return undefined;
}

function overrideSpecError(value: unknown, path = "overrides"): string | undefined {
  if (value === undefined) return undefined;
  const pending: Array<{ value: unknown; path: string }> = [{ value, path }];
  while (pending.length) {
    const current = pending.pop();
    if (!current) continue;
    if (typeof current.value === "string") {
      // npm's $name references reuse a dependency spec already declared above.
      if (current.value.startsWith("$")) continue;
      if (!isRegistryDependencySpec(current.value)) {
        return dependencyErrorTail(`override ${current.path} uses a non-registry spec (${current.value}); only registry versions are installable`);
      }
      continue;
    }
    if (!current.value || typeof current.value !== "object" || Array.isArray(current.value)) {
      return `override ${current.path} must be a JSON object or registry version`;
    }
    for (const [name, nested] of Object.entries(current.value as Record<string, unknown>)) {
      pending.push({ value: nested, path: `${current.path}.${name}` });
    }
  }
  return undefined;
}

function unsafeLockfilePackagePath(location: string): boolean {
  if (location === "") return false;
  const parts = location.split("/");
  return (
    !location.startsWith("node_modules/") ||
    location.includes("\\") ||
    parts.includes("..") ||
    parts.some((part) => part.length === 0)
  );
}

function lockfileHasUnsafeSource(value: unknown): boolean {
  const pending: unknown[] = [value];
  while (pending.length) {
    const current = pending.pop();
    if (Array.isArray(current)) {
      pending.push(...current);
      continue;
    }
    if (!current || typeof current !== "object") continue;
    for (const [key, nested] of Object.entries(current as Record<string, unknown>)) {
      if (key === "packages" && nested && typeof nested === "object" && !Array.isArray(nested)) {
        if (Object.keys(nested).some(unsafeLockfilePackagePath)) return true;
      }
      if (LOCKFILE_DEPENDENCY_FIELDS.has(key) && nested && typeof nested === "object" && !Array.isArray(nested)) {
        for (const spec of Object.values(nested as Record<string, unknown>)) {
          if (typeof spec === "string" && !isRegistryDependencySpec(spec)) return true;
        }
      }
      if (key === "resolved") {
        if (
          typeof nested !== "string" ||
          (nested.length > 0 && !nested.startsWith(PUBLIC_NPM_REGISTRY))
        ) {
          return true;
        }
      }
      if (key === "link" && nested === true) return true;
      if ((key === "version" || key === "from") && typeof nested === "string" && nested.length > 0) {
        if (!isRegistryDependencySpec(nested)) return true;
      }
      pending.push(nested);
    }
  }
  return false;
}

export function defaultDependencyRunner(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  envOverrides?: Record<string, string>,
): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    // Shell only where npm is a .cmd shim (Windows); every arg is a literal.
    // A shell kill on Windows terminates the shim, possibly leaving npm
    // itself running — the process-tree kill below handles both.
    // Explicit minimal environment: npm must not see npm auth tokens,
    // proxy/SSH configuration or anything else from the desktop process.
    const isolatedUserConfig = join(tmpdir(), `.pi-desktop-npm-user-${randomUUID()}.npmrc`);
    const isolatedGlobalConfig = join(tmpdir(), `.pi-desktop-npm-global-${randomUUID()}.npmrc`);
    const isolatedGit = join(tmpdir(), `.pi-desktop-npm-git-${randomUUID()}`);
    const isolatedCache = join(cwd, ".npm-cache");
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === "win32",
      detached: process.platform !== "win32",
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? process.env.USERPROFILE ?? "",
        TMPDIR: process.env.TMPDIR ?? process.env.TEMP ?? "",
        LANG: process.env.LANG ?? "en_US.UTF-8",
        npm_config_userconfig: isolatedUserConfig,
        npm_config_globalconfig: isolatedGlobalConfig,
        npm_config_registry: PUBLIC_NPM_REGISTRY,
        npm_config_proxy: "",
        npm_config_https_proxy: "",
        npm_config_noproxy: "*",
        npm_config_git: isolatedGit,
        npm_config_cache: isolatedCache,
        npm_config_ignore_scripts: "true",
        npm_config_audit: "false",
        npm_config_fund: "false",
        npm_config_update_notifier: "false",
        ...envOverrides,
      },
    });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > DEPENDENCY_STDERR_KEEP_CHARS * 2) {
        stderr = stderr.slice(-DEPENDENCY_STDERR_KEEP_CHARS);
      }
    });
    const killProcessTree = (signal: NodeJS.Signals) => {
      const pid = child.pid;
      if (!pid) return;
      if (process.platform === "win32") {
        const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
        killer.once("error", () => {
          // Best effort: the child close handler still settles the runner.
        });
        killer.unref();
        return;
      }
      try {
        process.kill(-pid, signal);
      } catch {
        child.kill(signal);
      }
    };
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      stderr += `\nnpm dependency install exceeded ${timeoutMs}ms and was terminated`;
      killProcessTree("SIGTERM");
      killTimer = setTimeout(() => killProcessTree("SIGKILL"), 5_000);
    }, timeoutMs);
    const settle = (fn: () => void) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      fn();
    };
    child.on("error", (err) => {
      settle(() => reject(err));
    });
    child.on("close", (code) => {
      settle(() => resolve({ code: code ?? 1, stderr }));
    });
  });
}

function sanitizeDependencyLockfiles(pluginDir: string): {
  snapshots: Map<string, string>;
  removedUnsafe: boolean;
} {
  const snapshots = new Map<string, string>();
  let removedUnsafe = false;
  for (const name of NPM_LOCKFILE_NAMES) {
    const lockPath = join(pluginDir, name);
    if (!existsSync(lockPath)) continue;
    const content = readFileSync(lockPath, "utf8");
    try {
      if (lockfileHasUnsafeSource(JSON.parse(content))) {
        rmSync(lockPath, { force: true });
        removedUnsafe = true;
      } else {
        snapshots.set(name, content);
      }
    } catch {
      rmSync(lockPath, { force: true });
      removedUnsafe = true;
    }
  }
  for (const name of NON_NPM_LOCKFILE_NAMES) {
    rmSync(join(pluginDir, name), { force: true });
  }
  return { snapshots, removedUnsafe };
}

function cleanupFailedDependencyInstall(
  pluginDir: string,
  snapshots: ReadonlyMap<string, string>,
): void {
  try {
    rmSync(join(pluginDir, "node_modules"), { recursive: true, force: true });
  } catch {
    // Best effort: the install result must remain reportable.
  }
  try {
    rmSync(join(pluginDir, ".npm-cache"), { recursive: true, force: true });
  } catch {
    // Best effort: the install result must remain reportable.
  }
  for (const name of NPM_LOCKFILE_NAMES) {
    const lockPath = join(pluginDir, name);
    const original = snapshots.get(name);
    try {
      if (original === undefined) rmSync(lockPath, { force: true });
      else writeFileSync(lockPath, original, "utf8");
    } catch {
      // Best effort: the install result must remain reportable.
    }
  }
}

function cleanupDependencyCache(pluginDir: string): void {
  try {
    rmSync(join(pluginDir, ".npm-cache"), { recursive: true, force: true });
  } catch {
    // Best effort cleanup after npm exits.
  }
}

/**
 * Install an imported extension's npm dependencies inside the generated plugin
 * directory. Resolution is bounded and lockfile-checked before `npm ci`; all
 * third-party lifecycle scripts remain disabled and failures never block import.
 */
export async function installExtensionDependencies(
  pluginDir: string,
  options?: { runner?: DependencyCommandRunner; timeoutMs?: number },
): Promise<ExtensionDependencyInstallResult> {
  const packageJsonPath = join(pluginDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    return { state: "skipped", reason: "no-package-json" };
  }
  let manifest: {
    dependencies?: unknown;
    optionalDependencies?: unknown;
    devDependencies?: unknown;
    peerDependencies?: unknown;
    overrides?: unknown;
  };
  try {
    manifest = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  } catch (err) {
    return {
      state: "failed",
      error: `package.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { state: "failed", error: "package.json is not a JSON object" };
  }
  for (const field of [
    "dependencies",
    "optionalDependencies",
    "devDependencies",
    "peerDependencies",
  ] as const) {
    const error = dependencyMapError(field, manifest[field]);
    if (error) return { state: "failed", error };
  }
  const overrideError = overrideSpecError(manifest.overrides);
  if (overrideError) return { state: "failed", error: overrideError };
  let lockfiles: { snapshots: Map<string, string>; removedUnsafe: boolean };
  try {
    lockfiles = sanitizeDependencyLockfiles(pluginDir);
  } catch (err) {
    return {
      state: "failed",
      error: `could not inspect dependency lockfile: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const hasDependencies = [manifest.dependencies, manifest.optionalDependencies].some(
    (value) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0,
  );
  if (!hasDependencies) {
    return { state: "skipped", reason: "no-dependencies" };
  }
  const runner = options?.runner ?? defaultDependencyRunner;
  const timeoutMs = options?.timeoutMs ?? NPM_INSTALL_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  const runNpm = (args: string[], envOverrides?: Record<string, string>) =>
    runner("npm", args, pluginDir, Math.max(1, deadline - Date.now()), envOverrides);
  const failed = (message: string): ExtensionDependencyInstallResult => {
    cleanupFailedDependencyInstall(pluginDir, lockfiles.snapshots);
    return { state: "failed", error: dependencyErrorTail(message) };
  };
  const execute = async (envOverrides?: Record<string, string>): Promise<ExtensionDependencyInstallResult> => {
    try {
      const resolution = await runNpm([
        "install",
        "--package-lock-only",
        "--omit=dev",
        "--legacy-peer-deps",
        "--no-audit",
        "--no-fund",
        "--ignore-scripts",
      ], envOverrides);
      if (resolution.code !== 0) {
        return failed(`npm dependency resolution exited ${resolution.code}: ${resolution.stderr.trim()}`);
      }
      const resolvedLockfiles = sanitizeDependencyLockfiles(pluginDir);
      if (resolvedLockfiles.removedUnsafe) {
        return failed("npm dependency resolution produced a non-registry lockfile source");
      }
      const install = await runNpm([
        "ci",
        "--omit=dev",
        "--legacy-peer-deps",
        "--no-audit",
        "--no-fund",
        "--ignore-scripts",
      ], envOverrides);
      if (install.code !== 0) {
        return failed(`npm dependency install exited ${install.code}: ${install.stderr.trim()}`);
      }
      return { state: "installed" };
    } catch (err) {
      return failed(dependencyRunnerError(err));
    }
  };
  try {
    if (options?.runner) return await execute();
    return await withRegistryOnlyProxy((proxyUrl) =>
      execute({
        npm_config_proxy: proxyUrl,
        npm_config_https_proxy: proxyUrl,
        npm_config_noproxy: "",
      }),
    );
  } catch (err) {
    return failed(dependencyRunnerError(err));
  } finally {
    cleanupDependencyCache(pluginDir);
  }
}
