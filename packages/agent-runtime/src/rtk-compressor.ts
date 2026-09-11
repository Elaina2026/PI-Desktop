/**
 * RTK Tool Output Compressor.
 * Automatically detects and compresses verbose tool outputs (git diff, git status,
 * git log, grep, find, ls, build logs, and repetitive outputs) before adding to LLM context.
 */

export const MIN_COMPRESS_SIZE = 300;
export const RAW_CAP = 10 * 1024 * 1024;
export const DETECT_WINDOW = 1024;
export const SMART_TRUNCATE_MIN_LINES = 150;
export const SMART_TRUNCATE_HEAD = 60;
export const SMART_TRUNCATE_TAIL = 40;
export const GREP_PER_FILE_MAX = 10;
export const FIND_PER_DIR_MAX = 10;
export const FIND_TOTAL_DIR_MAX = 20;
export const GIT_DIFF_HUNK_MAX_LINES = 100;
export const DEDUP_LINE_MAX = 500;

const RE_GIT_DIFF = /^diff --git /m;
const RE_GIT_DIFF_HUNK = /^@@ /m;
const RE_GIT_STATUS = /^On branch |^nothing to commit|^Changes (not |to be )|^Untracked files:/m;
const RE_GIT_LOG = /^[*|/\\ ]*commit [0-9a-f]{7,40}$/m;
const RE_PORCELAIN = /^[ MADRCU?!][ MADRCU?!] \S/m;
const RE_BUILD_OUTPUT =
  /^(npm (warn|error|ERR!)|yarn (warn|error)|\s*Compiling\s+\S+|\s*Downloading\s+\S+|added \d+ package|\[ERROR\]|BUILD (SUCCESS|FAILED)|\s*Finished\s+|Successfully (installed|built)|ERROR:)/im;
const RE_LS_TOTAL = /^total \d+$/m;
const RE_LS_ROW = /^[-dlbcps][rwx-]{9}/m;

export function gitDiff(diff: string, maxLines = 500): string {
  const result: string[] = [];
  let currentFile = "";
  let added = 0;
  let removed = 0;
  let inHunk = false;
  let hunkShown = 0;
  let hunkSkipped = 0;

  const lines = diff.split("\n");

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      if (hunkSkipped > 0) {
        result.push(`  ... (${hunkSkipped} lines truncated)`);
        hunkSkipped = 0;
      }
      if (currentFile && (added > 0 || removed > 0)) {
        result.push(`  +${added} -${removed}`);
      }
      const parts = line.split(" b/");
      currentFile = parts.length > 1 ? parts.slice(1).join(" b/") : "unknown";
      result.push(`\n${currentFile}`);
      added = 0;
      removed = 0;
      inHunk = false;
      hunkShown = 0;
    } else if (line.startsWith("@@")) {
      if (hunkSkipped > 0) {
        result.push(`  ... (${hunkSkipped} lines truncated)`);
        hunkSkipped = 0;
      }
      inHunk = true;
      hunkShown = 0;
      result.push(`  ${line}`);
    } else if (inHunk) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        added += 1;
        if (hunkShown < GIT_DIFF_HUNK_MAX_LINES) {
          result.push(`  ${line}`);
          hunkShown += 1;
        } else {
          hunkSkipped += 1;
        }
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        removed += 1;
        if (hunkShown < GIT_DIFF_HUNK_MAX_LINES) {
          result.push(`  ${line}`);
          hunkShown += 1;
        } else {
          hunkSkipped += 1;
        }
      } else if (hunkShown < GIT_DIFF_HUNK_MAX_LINES && !line.startsWith("\\")) {
        if (hunkShown > 0) {
          result.push(`  ${line}`);
          hunkShown += 1;
        }
      }
    }

    if (result.length >= maxLines) {
      result.push("\n... (more changes truncated)");
      break;
    }
  }

  if (hunkSkipped > 0) {
    result.push(`  ... (${hunkSkipped} lines truncated)`);
  }
  if (currentFile && (added > 0 || removed > 0)) {
    result.push(`  +${added} -${removed}`);
  }

  return result.join("\n").trim();
}

export function gitStatus(input: string): string {
  const lines = input.split("\n");
  if (lines.length === 0 || (lines.length === 1 && !lines[0].trim())) {
    return "Clean working tree";
  }

  let branch = "";
  const stagedFiles: string[] = [];
  const modifiedFiles: string[] = [];
  const untrackedFiles: string[] = [];
  let staged = 0;
  let modified = 0;
  let untracked = 0;

  for (const raw of lines) {
    if (!raw.trim()) continue;

    const longBranch = raw.match(/^On branch (\S+)/);
    if (longBranch) {
      branch = longBranch[1];
      continue;
    }
    if (raw.startsWith("##")) {
      branch = raw.replace(/^##\s*/, "");
      continue;
    }

    if (raw.length >= 3 && /^[ MADRCU?!][ MADRCU?!] /.test(raw)) {
      const x = raw[0];
      const y = raw[1];
      const file = raw.slice(3);

      if (raw.slice(0, 2) === "??") {
        untracked++;
        if (untrackedFiles.length < 10) untrackedFiles.push(file);
        continue;
      }
      if ("MADRC".includes(x)) {
        staged++;
        if (stagedFiles.length < 10) stagedFiles.push(file);
      }
      if (y === "M" || y === "D") {
        modified++;
        if (modifiedFiles.length < 10) modifiedFiles.push(file);
      }
    }
  }

  const out: string[] = [];
  if (branch) out.push(`Branch: ${branch}`);
  if (staged > 0) {
    out.push(`+ Staged (${staged}): ${stagedFiles.join(", ")}${staged > 10 ? ` +${staged - 10} more` : ""}`);
  }
  if (modified > 0) {
    out.push(`~ Modified (${modified}): ${modifiedFiles.join(", ")}${modified > 10 ? ` +${modified - 10} more` : ""}`);
  }
  if (untracked > 0) {
    out.push(`? Untracked (${untracked}): ${untrackedFiles.join(", ")}${untracked > 10 ? ` +${untracked - 10} more` : ""}`);
  }

  return out.length > 0 ? out.join("\n") : input;
}

export function gitLog(input: string): string {
  const lines = input.split("\n");
  const out: string[] = [];
  let currentCommit = "";

  for (const line of lines) {
    const commitMatch = line.match(/^commit ([0-9a-f]{7,40})/);
    if (commitMatch) {
      currentCommit = commitMatch[1].slice(0, 8);
    } else if (line.startsWith("    ") && currentCommit) {
      const msg = line.trim();
      if (msg) {
        out.push(`${currentCommit} ${msg}`);
        currentCommit = "";
      }
    }
  }

  return out.length > 0 ? out.slice(0, 100).join("\n") : input;
}

export function grep(input: string): string {
  const byFile = new Map<string, Array<[string, string]>>();
  let total = 0;

  for (const line of input.split("\n")) {
    const first = line.indexOf(":");
    if (first === -1) continue;
    const second = line.indexOf(":", first + 1);
    if (second === -1) continue;
    const file = line.slice(0, first);
    const lineNumStr = line.slice(first + 1, second);
    const content = line.slice(second + 1);

    if (!/^\d+$/.test(lineNumStr)) continue;
    total++;
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file)!.push([lineNumStr, content]);
  }

  if (total === 0) return input;

  const files = Array.from(byFile.keys()).sort();
  let out = `${total} matches in ${files.length} files:\n\n`;

  for (const file of files) {
    const matches = byFile.get(file)!;
    out += `[file] ${file} (${matches.length}):\n`;
    const show = matches.slice(0, GREP_PER_FILE_MAX);
    for (const [lineNum, content] of show) {
      out += `  ${lineNum.padStart(4)}: ${content.trim()}\n`;
    }
    if (matches.length > GREP_PER_FILE_MAX) {
      out += `  +${matches.length - GREP_PER_FILE_MAX} more\n`;
    }
    out += "\n";
  }

  return out.trim();
}

export function find(input: string): string {
  const lines = input.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return input;

  const byDir = new Map<string, string[]>();

  for (const path of lines) {
    const lastSep = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    let dir: string;
    let basename: string;
    if (lastSep === -1) {
      dir = ".";
      basename = path;
    } else {
      dir = path.slice(0, lastSep) || "/";
      basename = path.slice(lastSep + 1);
    }
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir)!.push(basename);
  }

  const dirs = Array.from(byDir.keys()).sort();
  let out = `${lines.length} files in ${dirs.length} dirs:\n\n`;

  const showDirs = dirs.slice(0, FIND_TOTAL_DIR_MAX);
  for (const dir of showDirs) {
    const files = byDir.get(dir)!;
    const dirLabel = dir.replace(/\\/g, "/");
    out += `${dirLabel}/ (${files.length})\n`;
    const showFiles = files.slice(0, FIND_PER_DIR_MAX);
    for (const f of showFiles) out += `  ${f}\n`;
    if (files.length > FIND_PER_DIR_MAX) {
      out += `  +${files.length - FIND_PER_DIR_MAX} more\n`;
    }
  }
  if (dirs.length > FIND_TOTAL_DIR_MAX) {
    out += `\n+${dirs.length - FIND_TOTAL_DIR_MAX} more dirs\n`;
  }

  return out.trim();
}

export function dedupLog(input: string): string {
  const lines = input.split("\n");
  const out: string[] = [];
  let prev: string | null = null;
  let runCount = 0;

  const flushRun = () => {
    if (prev !== null && runCount > 1) {
      out.push(`  ... (${runCount - 1} duplicate lines)`);
    }
  };

  for (const line of lines) {
    if (line === prev) {
      runCount += 1;
      continue;
    }
    flushRun();
    out.push(line);
    prev = line;
    runCount = 1;

    if (out.length >= DEDUP_LINE_MAX) {
      out.push(`... (truncated at ${DEDUP_LINE_MAX} lines)`);
      return out.join("\n");
    }
  }
  flushRun();
  return out.join("\n");
}

export function smartTruncate(input: string): string {
  const lines = input.split("\n");
  if (lines.length < SMART_TRUNCATE_MIN_LINES) return input;

  const head = lines.slice(0, SMART_TRUNCATE_HEAD);
  const tail = lines.slice(lines.length - SMART_TRUNCATE_TAIL);
  const cut = lines.length - head.length - tail.length;
  return [...head, `... +${cut} lines truncated`, ...tail].join("\n");
}

function autoDetectFilter(text: string): ((input: string) => string) | null {
  const head = text.length > DETECT_WINDOW ? text.slice(0, DETECT_WINDOW) : text;

  if (RE_GIT_LOG.test(head)) return gitLog;
  if (RE_GIT_DIFF.test(head) || RE_GIT_DIFF_HUNK.test(head)) return gitDiff;
  if (RE_GIT_STATUS.test(head) || RE_PORCELAIN.test(head)) return gitStatus;

  const lines = head.split("\n");
  const nonEmpty = lines.filter((l) => l.trim().length > 0);

  // Check grep line pattern file:line:content
  if (
    nonEmpty.slice(0, 5).some((l) => {
      const p1 = l.indexOf(":");
      if (p1 === -1) return false;
      const p2 = l.indexOf(":", p1 + 1);
      return p2 !== -1 && /^\d+$/.test(l.slice(p1 + 1, p2));
    })
  ) {
    return grep;
  }

  // Find pattern
  if (
    nonEmpty.length >= 3 &&
    nonEmpty.every((l) => !l.includes(":") && (l.includes("/") || l.includes("\\")))
  ) {
    return find;
  }

  if (RE_LS_TOTAL.test(head) || lines.filter((l) => RE_LS_ROW.test(l)).length >= 3) {
    return dedupLog;
  }

  if (nonEmpty.length >= 5) return dedupLog;
  if (lines.length >= SMART_TRUNCATE_MIN_LINES) return smartTruncate;

  return null;
}

/**
 * Compresses tool stdout or file text using the best suited RTK filter.
 * Guaranteed safe: never returns empty, never grows input size.
 */
export function compressToolText(text: string): string {
  const bytesIn = text.length;
  if (bytesIn < MIN_COMPRESS_SIZE || bytesIn > RAW_CAP) {
    return text;
  }

  try {
    const filter = autoDetectFilter(text);
    if (!filter) return text;

    const out = filter(text);
    if (!out || out.length === 0 || out.length >= bytesIn) {
      return text;
    }
    return out;
  } catch {
    return text;
  }
}

/**
 * Compresses text entries inside an AgentToolResult content array.
 */
export function compressToolContent<T extends Array<{ type?: string; text?: string }>>(
  content: T,
): T {
  if (!Array.isArray(content)) return content;

  return content.map((item) => {
    if (item && item.type === "text" && typeof item.text === "string") {
      const compressed = compressToolText(item.text);
      if (compressed !== item.text) {
        return { ...item, text: compressed };
      }
    }
    return item;
  }) as T;
}
