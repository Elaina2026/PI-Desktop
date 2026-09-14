import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
import { IPC, type PlanFileInfo } from "@pi-desktop/shared";
import type { IpcRegistrar } from "./types";

export type RegisterTodoPlanIpcDependencies = {
  dataDir: string;
  sendToRenderer: (channel: string, data?: unknown) => void;
  currentWorkspacePath: () => string | null;
};

export function getPlanDirectory(dataDir: string, _workspacePath?: string | null): string {
  return join(dataDir, "plans");
}

export async function savePlanToDisk(
  dataDir: string,
  title: string,
  markdown: string,
  preferredFilename?: string,
  _workspacePath?: string | null,
  sendToRenderer?: (channel: string, data?: unknown) => void,
): Promise<{ path: string; filename: string; relativePath: string }> {
  const dir = join(dataDir, "plans");
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const globalPiDir = join(homedir(), ".pi", "plan");
  if (!existsSync(globalPiDir)) {
    await mkdir(globalPiDir, { recursive: true }).catch(() => undefined);
  }

  let filename = preferredFilename?.trim();
  if (!filename) {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const cleanTitle = (title || "plan")
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^\p{L}\p{N}-]+/gu, "")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    filename = `${cleanTitle || "plan"}-${dateStr}.md`;
  }
  if (!filename.endsWith(".md")) filename += ".md";

  const filePath = join(dir, filename);
  await writeFile(filePath, markdown, "utf8");

  const piFilePath = join(globalPiDir, filename);
  await writeFile(piFilePath, markdown, "utf8").catch(() => undefined);

  if (sendToRenderer) {
    sendToRenderer(IPC.event.sessionsChanged, { reason: "plan" });
  }
  return {
    path: filePath,
    filename,
    relativePath: `~/.pi-desktop/plans/${filename}`,
  };
}

export async function listPlanFilesInDisk(
  dataDir: string,
  currentWorkspacePath?: () => string | null,
): Promise<PlanFileInfo[]> {
  const ws = currentWorkspacePath ? currentWorkspacePath() : null;
  const dirsToScan = [
    join(dataDir, "plans"),
    join(homedir(), ".pi", "plan"),
    join(homedir(), ".pi", "plans"),
    ws ? join(ws, ".pi-desktop", "plans") : null,
    ws ? join(ws, ".pi", "plan") : null,
  ].filter(Boolean) as string[];

  const seen = new Set<string>();
  const plans: PlanFileInfo[] = [];

  for (const dir of dirsToScan) {
    if (!existsSync(dir)) continue;
    try {
      const files = await readdir(dir);
      for (const filename of files) {
        if (!filename.endsWith(".md") || seen.has(filename)) continue;
        seen.add(filename);
        const fullPath = join(dir, filename);
        const st = await stat(fullPath);
        let title = filename.replace(/\.md$/, "");
        try {
          const head = await readFile(fullPath, "utf8");
          const firstHeading = head.match(/^#\s+(.+)$/m);
          if (firstHeading?.[1]) {
            title = firstHeading[1].trim();
          }
        } catch {}
        plans.push({
          filename,
          title,
          path: fullPath,
          relativePath: `~/.pi-desktop/plans/${filename}`,
          updatedAt: st.mtimeMs,
          size: st.size,
        });
      }
    } catch {}
  }

  plans.sort((a, b) => b.updatedAt - a.updatedAt);
  return plans;
}

export async function readPlanFromDisk(
  dataDir: string,
  reqPath: string,
  currentWorkspacePath?: () => string | null,
): Promise<{ ok: boolean; content: string; title: string; path: string }> {
  let fullPath = reqPath;
  if (reqPath.startsWith("~/") || reqPath.startsWith("~\\")) {
    fullPath = join(homedir(), reqPath.slice(2));
  } else if (!isAbsolute(reqPath)) {
    fullPath = join(dataDir, reqPath);
  }
  if (!existsSync(fullPath)) {
    const fname = basename(reqPath);
    const ws = currentWorkspacePath ? currentWorkspacePath() : null;
    const candidates = [
      join(dataDir, "plans", fname),
      join(homedir(), ".pi", "plan", fname),
      join(homedir(), ".pi", "plans", fname),
      ws ? join(ws, ".pi-desktop", "plans", fname) : null,
      ws ? join(ws, ".pi", "plan", fname) : null,
    ].filter(Boolean) as string[];
    const found = candidates.find((c) => existsSync(c));
    if (found) fullPath = found;
    else throw new Error(`Plan file not found: ${reqPath}`);
  }
  const content = await readFile(fullPath, "utf8");
  const heading = content.match(/^#\s+(.+)$/m);
  const title = heading?.[1]?.trim() || basename(fullPath, ".md");
  return { ok: true, content, title, path: fullPath };
}

export function registerTodoPlanIpc(
  registrar: IpcRegistrar,
  dependencies: RegisterTodoPlanIpcDependencies,
) {
  const { dataDir, sendToRenderer, currentWorkspacePath } = dependencies;
  const { handle } = registrar;

  handle(IPC.invoke.todoList, async () => {
    const p = join(dataDir, "plugins", "data", "pi.todo", "settings.json");
    if (existsSync(p)) {
      try {
        const data = JSON.parse(readFileSync(p, "utf8"));
        return {
          ok: true,
          todos: Array.isArray(data.todos) ? data.todos : [],
          todosUpdatedAt: data.todosUpdatedAt ?? Date.now(),
        };
      } catch {}
    }
    return { ok: true, todos: [], todosUpdatedAt: Date.now() };
  });

  handle(IPC.invoke.todoSave, async (input: { todos?: unknown[] } = {}) => {
    const p = join(dataDir, "plugins", "data", "pi.todo", "settings.json");
    const dir = dirname(p);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const payload = {
      todos: Array.isArray(input?.todos) ? input.todos : [],
      todosUpdatedAt: Date.now(),
    };
    writeFileSync(p, JSON.stringify(payload, null, 2), "utf8");
    sendToRenderer(IPC.event.sessionsChanged, { reason: "todo" });
    return { ok: true, count: payload.todos.length };
  });

  handle(IPC.invoke.planListFiles, async () => {
    const plans = await listPlanFilesInDisk(dataDir, currentWorkspacePath);
    return { ok: true, plans };
  });

  handle(IPC.invoke.planReadFile, async (input: { path?: string } = {}) => {
    const reqPath = String(input?.path ?? "").trim();
    if (!reqPath) throw new Error("path required");
    return readPlanFromDisk(dataDir, reqPath, currentWorkspacePath);
  });

  handle(
    IPC.invoke.planSaveFile,
    async (input: { title?: string; markdown?: string; filename?: string } = {}) => {
      const title = String(input?.title ?? "").trim();
      const markdown = String(input?.markdown ?? "");
      const res = await savePlanToDisk(
        dataDir,
        title,
        markdown,
        input?.filename,
        undefined,
        sendToRenderer,
      );
      return { ok: true, path: res.path, filename: res.filename };
    },
  );
}
