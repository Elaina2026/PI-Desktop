import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolveOpenablePath } from "../electron/main/fs-panel.ts";

test("resolveOpenablePath resolves ~/.agents and subagent extra roots", () => {
  const agentsRoot = join(homedir(), ".agents");
  const path = join(agentsRoot, "subagents", "developer.md");
  const resolved = resolveOpenablePath(path, null, [agentsRoot]);
  assert.equal(resolved, path);

  const tildePath = "~/.agents/subagents/developer.md";
  const resolvedTilde = resolveOpenablePath(tildePath, null, [agentsRoot]);
  assert.equal(resolvedTilde, path);
});

test("TodoPlanTab exports extractTodosFromPlanMarkdown and parses action steps", async () => {
  const todoPlanTabCode = await readFile(
    new URL("../src/components/workpanel/TodoPlanTab.tsx", import.meta.url),
    "utf8",
  );
  assert.match(todoPlanTabCode, /export function extractTodosFromPlanMarkdown/);
  assert.match(todoPlanTabCode, /syncTodosFromPlan/);
  assert.match(todoPlanTabCode, /Tạo Todo list từ Plan/);
});

test("statsGetModelUsageSummary normalizes model keys and handles force refresh", async () => {
  const electronMain = await readFile(
    new URL("../electron/main/index.ts", import.meta.url),
    "utf8",
  );
  assert.match(electronMain, /normalizeModelKey/);
  assert.match(electronMain, /invalidateModelUsageSummaryCache/);
  assert.match(electronMain, /persistenceOutbox\?\.getEntries/);
});

test("oauth and vendor accounts handle disabled quota buckets and 401 refresh", async () => {
  const oauth = await readFile(
    new URL("../electron/main/oauth.ts", import.meta.url),
    "utf8",
  );
  const vendorAccounts = await readFile(
    new URL("../src/components/settings/VendorAccountsSection.tsx", import.meta.url),
    "utf8",
  );
  assert.match(oauth, /quotaRes\.status === 401 && cred\.refresh_token/);
  assert.match(oauth, /isLocked:\s*isDisabled/);
  assert.match(vendorAccounts, /0% \(Đã khóa \/ Hết hạn mức\)/);
  assert.match(vendorAccounts, /còn lại/);
});

test("Markdown.tsx sanitizes subagent xml tags outside code fences", async () => {
  const markdown = await readFile(
    new URL("../src/components/Markdown.tsx", import.meta.url),
    "utf8",
  );
  assert.match(markdown, /sanitizeSubagentXmlTags/);
  assert.match(markdown, /review_report/);
  assert.match(markdown, /verdict/);
});
