/**
 * Per-project agent memory (D-memory-001).
 *
 * Stores facts the agent learns about a project across sessions so that a new
 * session immediately knows the project's architecture, recent work, and any
 * notes the user explicitly saved.
 *
 * Storage layout:
 *   ~/.pi-desktop/memory/<cwd-hash>.json   per-project memory blob
 *   ~/.pi/agent/AGENTS.md                  global instruction file (stable
 *                                           facts are kept in a fenced section)
 *
 * Injection:
 *   Stable facts  → AGENTS.md section (already loaded by loadInstructionChain)
 *   Dynamic ctx   → injected as a synthetic ProjectInstructions entry at launch
 *   Raw notes     → appended to dynamic context section
 */

import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// ─── types ────────────────────────────────────────────────────────────────────

export interface ProjectMemory {
  version: 1;
  cwd: string;
  updatedAt: string;
  /** Permanent architectural facts — stable across sessions. */
  stableFacts: string[];
  /** Recent work, open issues, next steps — refreshed each session. */
  dynamicContext: string[];
  /** Manual /remember notes, kept verbatim. */
  rawNotes: string[];
}

export interface ExtractedMemory {
  stableFacts: string[];
  dynamicContext: string[];
}

// ─── paths ────────────────────────────────────────────────────────────────────

const MEMORY_DIR = join(homedir(), ".pi-desktop", "memory");
const GLOBAL_AGENTS_MD = join(homedir(), ".pi", "agent", "AGENTS.md");
const PI_MEMORY_START = "<!-- pi-memory:start -->";
const PI_MEMORY_END = "<!-- pi-memory:end -->";
const MEMORY_SECTION_HEADER = "## Project Memory (auto-generated)\n";

function memoryPath(cwd: string): string {
  const hash = createHash("md5").update(cwd).digest("hex");
  return join(MEMORY_DIR, `${hash}.json`);
}

// ─── load / save ──────────────────────────────────────────────────────────────

export async function loadMemory(cwd: string): Promise<ProjectMemory | null> {
  try {
    const raw = await readFile(memoryPath(cwd), "utf8");
    const parsed = JSON.parse(raw) as ProjectMemory;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveMemory(memory: ProjectMemory): Promise<void> {
  await mkdir(MEMORY_DIR, { recursive: true });
  await writeFile(memoryPath(memory.cwd), JSON.stringify(memory, null, 2), "utf8");
}

export function emptyMemory(cwd: string): ProjectMemory {
  return {
    version: 1,
    cwd,
    updatedAt: new Date().toISOString(),
    stableFacts: [],
    dynamicContext: [],
    rawNotes: [],
  };
}

// ─── merge ────────────────────────────────────────────────────────────────────

/**
 * Merge newly extracted facts into existing memory. Deduplicates by
 * normalizing to lowercase and trimming — keeps the newest phrasing.
 */
export function mergeMemory(
  existing: ProjectMemory,
  extracted: ExtractedMemory,
): ProjectMemory {
  const dedup = (old: string[], fresh: string[]): string[] => {
    const seen = new Set(fresh.map((s) => s.toLowerCase().trim()));
    const kept = old.filter((s) => !seen.has(s.toLowerCase().trim()));
    return [...kept, ...fresh].slice(-15); // cap at 15 entries
  };
  return {
    ...existing,
    updatedAt: new Date().toISOString(),
    stableFacts: dedup(existing.stableFacts, extracted.stableFacts).slice(-10),
    dynamicContext: dedup(existing.dynamicContext, extracted.dynamicContext).slice(-5),
  };
}

// ─── AGENTS.md sync ───────────────────────────────────────────────────────────

/**
 * Write the stable-facts section into ~/.pi/agent/AGENTS.md.
 * Only stable project architectural facts are synced; transient session
 * work is never written to global AGENTS.md to prevent cross-session task loops.
 */
export async function syncAgentsMd(memory: ProjectMemory): Promise<void> {
  // Only sync if there are permanent architectural facts or explicit user notes
  if (!memory.stableFacts.length && !memory.rawNotes.length) return;

  const bullets = [
    ...memory.stableFacts,
    ...memory.rawNotes.map((n) => `[user-note] ${n}`),
  ]
    .map((f) => `- ${f.replace(/^- /, "")}`)
    .join("\n");

  const section = [
    MEMORY_SECTION_HEADER,
    PI_MEMORY_START,
    bullets,
    PI_MEMORY_END,
  ].join("\n");

  let existing = "";
  try {
    existing = await readFile(GLOBAL_AGENTS_MD, "utf8");
  } catch {
    // file doesn't exist yet — create it
    await mkdir(dirname(GLOBAL_AGENTS_MD), { recursive: true });
  }

  const startIdx = existing.indexOf(PI_MEMORY_START);
  const endIdx = existing.indexOf(PI_MEMORY_END);

  let updated: string;
  if (startIdx !== -1 && endIdx !== -1) {
    const headerStart = existing.lastIndexOf(MEMORY_SECTION_HEADER, startIdx);
    const replaceFrom = headerStart !== -1 ? headerStart : startIdx;
    updated =
      existing.slice(0, replaceFrom).trimEnd() +
      "\n\n" +
      section +
      "\n" +
      existing.slice(endIdx + PI_MEMORY_END.length).trimStart();
  } else {
    updated = (existing.trimEnd() ? existing.trimEnd() + "\n\n" : "") + section + "\n";
  }

  await writeFile(GLOBAL_AGENTS_MD, updated, "utf8");
}

// ─── injection ────────────────────────────────────────────────────────────────

/**
 * Build a synthetic project instruction entry from memory.
 * Explicitly guards against re-executing already completed historical work.
 */
export function memoryToInstruction(
  memory: ProjectMemory,
): { source: string; content: string } | null {
  const lines: string[] = [];

  lines.push("<!-- READ-ONLY ARCHIVAL MEMORY: HISTORICAL CONTEXT ONLY -->");
  lines.push(
    "IMPORTANT RULE: The items below are ALREADY COMPLETED historical records from prior sessions. They are provided purely for background reference so you understand what already exists. NEVER re-execute, re-implement, repeat, or continue any task below unless the user's current prompt explicitly asks you to."
  );

  if (memory.stableFacts.length) {
    lines.push("\n### Project Conventions & Architecture");
    memory.stableFacts.forEach((f) => lines.push(`- ${f.replace(/^- /, "")}`));
  }

  if (memory.dynamicContext.length) {
    lines.push("\n### Already Completed Work in Past Sessions (Do Not Repeat)");
    memory.dynamicContext.forEach((l) => {
      const cleaned = l.replace(/^- /, "").replace(/^(\[DONE\]|\[COMPLETED\])\s*/i, "");
      lines.push(`- [DONE] ${cleaned}`);
    });
  }

  if (memory.rawNotes.length) {
    lines.push("\n### User Guidelines & Saved Notes");
    memory.rawNotes.forEach((n) => lines.push(`- ${n.replace(/^- /, "")}`));
  }

  if (lines.length <= 2) return null;
  return {
    source: "Project Memory (Read-Only Reference)",
    content: lines.join("\n"),
  };
}

// ─── extraction prompt ────────────────────────────────────────────────────────

/**
 * System prompt for the one-shot memory extraction call.
 */
export const MEMORY_EXTRACT_SYSTEM = [
  "You are a memory curator for a coding assistant. Extract durable facts from a session.",
  "",
  "Return ONLY valid JSON with this shape:",
  '{ "stableFacts": string[], "dynamicContext": string[] }',
  "",
  "stableFacts: Permanent architectural/decision facts about this project (max 10, each ≤80 chars).",
  "  Examples: 'Electron main process — never use sync I/O', 'CSS uses token variables, no raw px'",
  "",
  "dynamicContext: Completed achievements from this session (max 5, each ≤120 chars).",
  "  CRITICAL: Write ONLY in past completed tense (e.g., '[DONE] Fixed token-usages freeze', '[DONE] Created CLAUDE.md').",
  "  DO NOT extract 'next steps', pending tasks, or imperative commands (like 'Add feature X', 'Fix Y').",
  "",
  "Rules:",
  "- Omit trivial facts (e.g. 'user greeted me', 'session started')",
  "- Do not repeat facts already in existing memory",
  "- If nothing is worth extracting, return empty arrays",
  "- Output ONLY the JSON object — no markdown, no explanation",
].join("\n");

export function memoryExtractUserMessage(
  existingMemory: ProjectMemory | null,
  sessionSummary: string,
): string {
  const existing = existingMemory
    ? JSON.stringify(
        {
          stableFacts: existingMemory.stableFacts,
          dynamicContext: existingMemory.dynamicContext,
          rawNotes: existingMemory.rawNotes,
        },
        null,
        2,
      )
    : "{}";

  return [
    "Existing memory:",
    "```json",
    existing,
    "```",
    "",
    "Session transcript summary:",
    sessionSummary,
  ].join("\n");
}
