import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { parseSkillFrontmatter } from "@pi-desktop/plugin-sdk";

export type ExternalSkillItem = {
  id: string;
  name: string;
  description?: string;
  path: string;
  source: "claude" | "codex" | "pi" | "agents";
  level: "global" | "project";
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveCandidateDirs(projectPath?: string | null): Array<{ dir: string; source: ExternalSkillItem["source"]; level: ExternalSkillItem["level"] }> {
  const home = homedir();
  const candidates: Array<{ dir: string; source: ExternalSkillItem["source"]; level: ExternalSkillItem["level"] }> = [
    // Global roots
    { dir: join(home, ".claude", "skills"), source: "claude", level: "global" },
    { dir: join(home, ".codex", "skills"), source: "codex", level: "global" },
    { dir: join(home, ".pi", "skills"), source: "pi", level: "global" },
    { dir: join(home, ".pi", "agent", "skills"), source: "pi", level: "global" },
    { dir: join(home, ".agents", "skills"), source: "agents", level: "global" },
  ];

  if (projectPath && typeof projectPath === "string" && projectPath.trim()) {
    const root = projectPath.trim();
    // Project roots (higher priority)
    candidates.unshift(
      { dir: join(root, ".claude", "skills"), source: "claude", level: "project" },
      { dir: join(root, ".codex", "skills"), source: "codex", level: "project" },
      { dir: join(root, ".pi", "skills"), source: "pi", level: "project" },
      { dir: join(root, ".agents", "skills"), source: "agents", level: "project" },
    );
  }

  return candidates;
}

/**
 * Scan external skill directories from Claude Code, Codex, Pi, and Agents.
 * Supports both `<dir>/<skill>/SKILL.md` and `<dir>/<skill>.md` conventions.
 */
export function scanExternalSkills(projectPath?: string | null): ExternalSkillItem[] {
  const candidateRoots = resolveCandidateDirs(projectPath);
  const skillsById = new Map<string, ExternalSkillItem>();

  for (const { dir, source, level } of candidateRoots) {
    if (!existsSync(dir)) continue;

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        let skillFilePath: string | null = null;
        let inferredId = "";

        if (entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith(".")) {
          skillFilePath = join(dir, entry.name);
          inferredId = basename(entry.name, ".md");
        } else if (entry.isDirectory() && !entry.name.startsWith(".")) {
          const nestedSkillMd = join(dir, entry.name, "SKILL.md");
          const nestedLowerSkillMd = join(dir, entry.name, "skill.md");
          if (existsSync(nestedSkillMd)) {
            skillFilePath = nestedSkillMd;
            inferredId = entry.name;
          } else if (existsSync(nestedLowerSkillMd)) {
            skillFilePath = nestedLowerSkillMd;
            inferredId = entry.name;
          }
        }

        if (!skillFilePath) continue;

        try {
          const raw = readFileSync(skillFilePath, "utf8");
          if (!raw.trim()) continue;

          const parsed = parseSkillFrontmatter(raw);
          const rawName = parsed.name || inferredId;
          const id = slugify(inferredId || rawName) || inferredId;

          // Project skills take precedence over global skills; first scanned in array wins
          if (!skillsById.has(id)) {
            skillsById.set(id, {
              id,
              name: rawName,
              description: parsed.description || undefined,
              path: skillFilePath,
              source,
              level,
            });
          }
        } catch {
          // Ignore unreadable individual skill files
        }
      }
    } catch {
      // Ignore unreadable skill directory
    }
  }

  return Array.from(skillsById.values());
}

/**
 * Read the body of an external skill by ID.
 */
export function loadExternalSkillBody(
  id: string,
  projectPath?: string | null,
): { id: string; name: string; body: string; path: string } | null {
  const skills = scanExternalSkills(projectPath);
  const matched = skills.find((s) => s.id === id || slugify(s.name) === id);
  if (!matched) return null;

  try {
    const raw = readFileSync(matched.path, "utf8");
    const parsed = parseSkillFrontmatter(raw);
    return {
      id: matched.id,
      name: parsed.name || matched.name,
      body: parsed.body || raw,
      path: matched.path,
    };
  } catch {
    return null;
  }
}
