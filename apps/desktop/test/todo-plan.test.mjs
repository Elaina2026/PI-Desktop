import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readMainSource, readTranscriptSource } from "./helpers/source-contracts.mjs";

const workPanelTabs = await readFile(
  new URL("../src/lib/work-panel-tabs.ts", import.meta.url),
  "utf8",
);
const protocol = await readFile(
  new URL("../../../packages/shared/src/protocol.ts", import.meta.url),
  "utf8",
);
const electronMain = await readMainSource();
const topbar = await readFile(
  new URL("../src/components/ConversationTopbar.tsx", import.meta.url),
  "utf8",
);
const chatTranscript = await readTranscriptSource();
const messagesCss = await readFile(
  new URL("../src/styles/messages.css", import.meta.url),
  "utf8",
);
const todoPlanTab = await readFile(
  new URL("../src/components/workpanel/TodoPlanTab.tsx", import.meta.url),
  "utf8",
);
const settingsCss = await readFile(
  new URL("../src/styles/settings.css", import.meta.url),
  "utf8",
);

const modePrompts = await readFile(
  new URL("../../../packages/agent-runtime/src/mode-prompts.ts", import.meta.url),
  "utf8",
);
const agentSidecar = await readFile(
  new URL("../electron/main/agent-sidecar.ts", import.meta.url),
  "utf8",
);
const agentRuntime = await readFile(
  new URL("../../../packages/agent-runtime/src/runtime.ts", import.meta.url),
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

test("ChatTranscript renders natural chat checklist for todo tool calls with done, in_progress, and pending states", () => {
  assert.match(chatTranscript, /className="todo-chat-checklist"/);
  assert.match(chatTranscript, /className=\{`todo-chat-item \$\{task\.status\}`\}/);
  assert.match(chatTranscript, /<IconCheck size=\{11\} strokeWidth=\{2\.5\} \/>/);
  assert.match(chatTranscript, /<span className="todo-chat-box-star">\*<\/span>/);
  assert.match(messagesCss, /\.todo-chat-checklist/);
  assert.match(messagesCss, /\.todo-chat-item\.completed \.todo-chat-text\s*\{[^}]*text-decoration:\s*line-through/);
  assert.match(messagesCss, /\.todo-chat-item\.in_progress \.todo-chat-box/);
});

test("ChatTranscript renders todo items outside the collapsible tool-activity-group", () => {
  assert.match(chatTranscript, /const isTodoItem = \(item: AssistantActivityItem\): boolean =>/);
  assert.match(chatTranscript, /todoItems\.map\(\(item\) => \(\s*<ToolRow\s*key=\{`todo-standalone-\$\{item\.message\.id\}`\}/);
});

test("TodoPlanTab includes Auto Accept-Edit, No Approve, and plan answer input area", () => {
  assert.match(todoPlanTab, /Auto Accept-Edit/);
  assert.match(todoPlanTab, /No Approve/);
  assert.match(todoPlanTab, /plan-answer-textarea/);
  assert.match(settingsCss, /\.plan-answer-textarea/);
});

test("TodoPlanTab includes In Progress filter mode and white text for in_progress status", () => {
  assert.match(todoPlanTab, /"in_progress"/);
  assert.match(todoPlanTab, /In Progress/);
  assert.match(todoPlanTab, /isInProgress/);
  assert.match(todoPlanTab, /text-white/);
  assert.match(messagesCss, /\.todo-chat-item\.in_progress \.todo-chat-text\s*\{[^}]*color:\s*#ffffff\s*!important/);
});

test("agent mode prompt enforces plan formulation first for complex multi-step tasks", () => {
  assert.match(modePrompts, /Planning & Execution Workflow Discipline/);
  assert.match(modePrompts, /create and submit an implementation plan FIRST/);
  assert.match(modePrompts, /Only AFTER the plan is formulated and approved should you create the Todo list/);
});

test("PLAN_WORKSPACE_REQUIRED prevention and auto-bind logic is configured", () => {
  assert.match(electronMain, /ensureSessionProject/);
  assert.match(electronMain, /effectiveProjectPath/);
  assert.match(agentSidecar, /setProjectEnsurer/);
  assert.match(agentSidecar, /projectEnsurer/);
  assert.match(agentRuntime, /projectPath:\s*this\.projectPath/);
  assert.match(todoPlanTab, /PLAN_WORKSPACE_REQUIRED/);
});

test("Plan files are stored in .pi-desktop/plans/ and WorkPanel provides auto-scaling display", () => {
  assert.match(protocol, /planListFiles:\s*"pi-desktop\/plans\/listFiles"/);
  assert.match(protocol, /planReadFile:\s*"pi-desktop\/plans\/readFile"/);
  assert.match(protocol, /planSaveFile:\s*"pi-desktop\/plans\/saveFile"/);
  assert.match(electronMain, /getPlanDirectory/);
  assert.match(electronMain, /\.pi-desktop.*plans/);
  assert.match(electronMain, /savePlanToDisk/);
  assert.match(electronMain, /handle\(IPC\.invoke\.planListFiles/);
  assert.match(electronMain, /handle\(IPC\.invoke\.planReadFile/);
  assert.match(electronMain, /handle\(\s*IPC\.invoke\.planSaveFile/);
  assert.match(todoPlanTab, /listPlanFiles/);
  assert.match(todoPlanTab, /plan-file-bar/);
  assert.match(todoPlanTab, /plan-markdown-container prose-chat/);
  assert.match(settingsCss, /\.plan-file-bar/);
  assert.match(settingsCss, /\.plan-markdown-container\s*\{[^}]*overflow-wrap:\s*break-word/);
  assert.match(settingsCss, /\.plan-markdown-container h1/);
  assert.match(settingsCss, /\.plan-markdown-container pre/);
  assert.match(settingsCss, /\.plan-markdown-container table/);
});
