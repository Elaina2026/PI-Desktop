import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workPanelTabs = await readFile(
  new URL("../src/lib/work-panel-tabs.ts", import.meta.url),
  "utf8",
);
const protocol = await readFile(
  new URL("../../../packages/shared/src/protocol.ts", import.meta.url),
  "utf8",
);
const electronMain = await readFile(
  new URL("../electron/main/index.ts", import.meta.url),
  "utf8",
);
const topbar = await readFile(
  new URL("../src/components/ConversationTopbar.tsx", import.meta.url),
  "utf8",
);

test("todo-plan is a registered WorkPanel tab kind", () => {
  assert.match(workPanelTabs, /"todo-plan"/);
  assert.match(workPanelTabs, /todoPlanWorkPanelTab/);
});

test("IPC registers todoList and todoSave endpoints", () => {
  assert.match(protocol, /todoList:\s*"pi-desktop\/todo\/list"/);
  assert.match(protocol, /todoSave:\s*"pi-desktop\/todo\/save"/);
  assert.match(electronMain, /handle\(IPC\.invoke\.todoList/);
  assert.match(electronMain, /handle\(IPC\.invoke\.todoSave/);
});

test("ConversationTopbar contains Todo & Plan toggle button", () => {
  assert.match(topbar, /tooltip="Todo & Plan"/);
  assert.match(topbar, /todoPlanWorkPanelTab/);
});
