import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadStyles } from "./helpers/styles.mjs";

const read = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

const overlaySources = [
  "../src/components/settings/ProviderSetupDialog.tsx",
  "../src/components/settings/VendorAccountDialog.tsx",
  "../src/components/settings/VendorPickerDialog.tsx",
  "../src/components/settings/OAuthLoginDialog.tsx",
  "../src/components/settings/SkillEditorSheet.tsx",
  "../src/components/settings/SubagentEditorSheet.tsx",
  "../src/components/extensions/McpEditorSheet.tsx",
];

test("route entrance does not leave a transform containing block", async () => {
  const styles = await loadStyles();
  const start = styles.indexOf("@keyframes route-surface-in");
  assert.notEqual(start, -1, "missing @keyframes route-surface-in");
  const next = styles.indexOf("@keyframes", start + 1);
  const block = styles.slice(start, next === -1 ? undefined : next);
  assert.doesNotMatch(block, /transform:/);
  assert.match(block, /opacity:\s*0/);
  assert.doesNotMatch(
    styles,
    /\.route-surface,\s*\.settings-content-inner\s*\{[^}]*animation:\s*route-surface-in/,
  );
});

test("settings overlays mount on a viewport-fixed host outside the app shell", async () => {
  const styles = await loadStyles();
  assert.match(styles, /\n\.overlay \{\n  position: fixed;\n  inset: 0;/);

  const host = styles.match(/#pi-desktop-overlays \{[\s\S]*?\n\}/);
  assert.ok(host, "missing overlay host rule");
  assert.match(host[0], /position:\s*fixed/);
  assert.match(host[0], /inset:\s*0/);

  const ui = await read("../src/components/ui.tsx");
  assert.match(ui, /export function portalOverlay/);
  assert.match(ui, /pi-desktop-overlays/);
  assert.match(ui, /document\.documentElement\.appendChild/);
  assert.doesNotMatch(ui, /createPortal\(node, document\.body\)/);

  for (const rel of overlaySources) {
    const source = await read(rel);
    assert.match(source, /portalOverlay\(/, `${rel} must portal its overlay`);
  }
});
