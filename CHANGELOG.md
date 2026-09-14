# Changelog — PI-Desktop (Enhanced Edition)

All notable changes to this project are documented in this file.

---

## [0.14.8-enhanced] - 2026-09-14

### 🌟 Highlights

This release updates PI-Desktop to upstream **v0.14.8** (`6d70bd1c`), bringing the latest core platform refactoring, plugin architecture, and marketplace ecosystem, while preserving 100% of the custom enhancements: **Antigravity Google OAuth**, **9Router Usages Dashboard**, **Todo & Plan System**, and **Subagent Inspection**.

---

### 🚀 Custom Enhancements

#### 1. Antigravity (Google Cloud Code Assist) OAuth & Quota System
- **OAuth Authentication**: Direct Google OAuth login flow for Antigravity accounts without manual key copying.
- **Dual-Window Live Quota Tracking**:
  - Displays real-time quota for 4 distinct quota groups (Claude 3.5 Sonnet, Gemini 3.8 Pro, Gemini 3.8 Flash, and Code Chat).
  - Tracks both 5-hour rolling windows and weekly quota boundaries with exact countdowns (`Resets in Xh Ym`).
  - Correctly handles `disabled: true` quota buckets, displaying `0% (Đã khóa / Hết hạn mức)`.
- **Transparent Refresh & Auto-Failover**:
  - Automatically exchanges refresh tokens on HTTP 401.
  - Seamlessly fails over to alternative connected Antigravity accounts when an account encounters `HTTP 429` (rate limit) or quota exhaustion, preventing interrupted agent turns.

#### 2. 9Router-Style Token Usages & Model Activity Dashboard
- **Usages Page (`UsagesPage.tsx`)**:
  - Full-screen dashboard showing token consumption across all models, providers, and sessions.
  - Responsive SVG contribution heatmap (GitHub-style activity calendar) with day-by-day cost and token breakdown.
- **Deduplication & Real-Time Sync**:
  - `normalizeModelKey` strips `ag/`, `google/`, `anthropic/`, and `openai/` prefixes to eliminate duplicate model statistics.
  - Outbox message scanning and cache invalidation on new assistant messages.
  - Conversation Topbar mini-insights bar displaying live session input, output, reasoning tokens, and USD cost.

#### 3. Native Todo Checklist & Global Plan System
- **WorkPanel `todo-plan` Tab**:
  - Dedicated right-column tab for viewing and managing implementation plans and interactive todo items.
  - `extractTodosFromPlanMarkdown` parses action steps from plan markdown into checklist items.
- **Chat Transcript Standalone Checklist**:
  - Displays `todo` tool executions as an interactive checklist outside collapsible tool activity groups.
  - Custom status indicators: `[x]` checkmark for completed, `*` badge for in-progress with white text, and empty checkbox for pending tasks.
- **Global Storage & Workspace Auto-Binding**:
  - Plans are persisted globally at `~/.pi-desktop/plans/` (mirrored to `~/.pi/plan/`).
  - Automatic workspace binding in `session-launch.ts` resolves `PLAN_WORKSPACE_REQUIRED` errors during plan submissions.

#### 4. Subagent Preview & Tag Sanitization
- **File System Exploration**:
  - `fsExtraRoots` and `resolveOpenablePath` allow opening subagent definitions (such as `~/.agents/subagents/developer.md`) and project skills directly from chat.
- **Markdown XML Tag Cleaning**:
  - `sanitizeSubagentXmlTags` cleans raw internal tags (`<review_report>`, `<verdict>`, `<vuln>`, `<finding>`) from subagent outputs outside code fences.

#### 5. Productivity Prompts & Personas
- **Caveman Mode**: Maximum signal, fluff-free, terse technical communication.
- **Ponytail Discipline**: Minimal diffs, YAGNI, standard library first, zero unrequested boilerplate.
- **RTK Compressor**: Pre-prompt token optimizer reducing prompt token overhead.

---

### 📦 Upstream v0.14.8 & v0.14.7 Platform Additions

- **Architectural Modularization**:
  - Main process decomposed from a monolithic 10,000+ line file into clean domain modules (`bootstrap/`, `ipc/`, `runtime/`, `services/`).
  - Renderer modularized into feature directories (`features/chat/`, `features/settings/`, `features/app/`).
- **MCP & Skill Marketplaces**:
  - 1-Click browsing and installation of MCP servers from the official registry.
  - Skill Marketplace for installing curated skills directly from GitHub repositories with size and safety gates.
- **Three-Column Shell with Preview Mode**:
  - 450px hard floor for MainChat (`MAIN_PANE_MIN_WIDTH = 450`).
  - WorkPanel full-width Preview Mode.
  - Vendored File Manager plugin (`FileManagerPlugin`).
- **Subagent Upgrades**:
  - Subagents can inherit parent tools (`inheritTools`).
  - Added built-in `UI-designer` role.
  - Distinct creating / streaming state indicators.
- **Sandbox Preload Hardening**:
  - Isolated preload scripts for main app and plugin panels without local chunk dependencies, preventing packaged runtime crashes.

---

### 🐛 Bug Fixes & Refinements in this Build

- **WorkPanel Toggle Button**: Fixed duplicate icon glitch where both `IconPanel` and `IconPanelOpen` rendered simultaneously.
- **Antigravity Quota IPC**: Restored missing `IPC.invoke.providersOauthQuota` handler in `electron/main/ipc/provider-ipc.ts`, ensuring the 4 quota bars render properly.
- **Multi-locale i18n Sync**: Synchronized missing panel keys (`toolsAndPanels`, `tabsLabel`, `new`) across all 8 supported languages (`de`, `en`, `es`, `fr`, `ko`, `tr`, `zh-CN`, `zh-TW`).
- **Test Suite Updates**: Migrated custom test contracts (`subagent-plan-usage.test.mjs`, `todo-plan.test.mjs`) to use modular source readers (`helpers/main-source.mjs`).
