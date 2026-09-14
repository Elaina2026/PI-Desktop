# PI-Desktop — Claude Code System Prompt

## Project Overview
Electron desktop app for a local-first AI coding agent client.

**Stack:**
- Electron + electron-vite + React 19 + Tailwind v4 + Zustand (renderer)
- pnpm monorepo (pnpm@11) with workspaces: `apps/desktop`, `packages/agent-host`, `packages/agent-runtime`, `packages/i18n`, `packages/plugin-devkit`, `packages/plugin-sdk`, `packages/shared`, `docs`
- Rust `host-core` crate: `crates/host-core`
- TypeScript strict mode across all packages
- Vitest for package tests; `node:test` for `apps/desktop` tests

## Key Architecture

### Electron IPC Pattern
```
renderer → api.someMethod() → preload bridge → IPC.invoke.someChannel → main handler
```
- Main handlers: `apps/desktop/electron/main/index.ts`
- IPC channels: `apps/desktop/electron/shared/ipc.ts`
- Preload bridge: `apps/desktop/electron/preload/index.ts`

### CSS Design Token System
**NEVER use raw pixel/percentage values.** Always use CSS variables from `apps/desktop/src/styles/tokens.css`:
- Spacing: `var(--spacing-*)`, `var(--size-*)`
- Colors: `var(--color-*)`, semantic tokens from `@theme` block
- Font size: `var(--text-3xs)`, `var(--text-xs)`, `var(--text-sm)`, etc.
- Font weight: `var(--font-weight-medium)`, `var(--font-weight-semibold)`, etc.
- Border radius: `var(--radius-3xs)`, `var(--radius-full)`, `var(--radius-round)`, etc.

### Store Pattern (Zustand)
Stores in `apps/desktop/src/stores/`. Access via hooks, not direct import.

### Session Files
JSONL files at `~/.pi-desktop/sessions/*.jsonl`. Can be large (up to 24MB each).
Always use async I/O when reading in main process — never `readFileSync` on session files.

### PlanResolveRequest Protocol
```typescript
// action "approve" | "reject"
{ proposalId, sessionId, turnId, toolCallId, version, action, targetPermissionMode? }
```

## Build & Dev Commands

```bash
# Dev
pnpm dev                        # starts Electron app in dev mode

# Build
pnpm build:js                   # build all JS packages (not Electron app)
pnpm --filter @pi-desktop/desktop run build  # build the Electron app

# Typecheck (all packages, excludes root and docs)
pnpm typecheck

# Test
pnpm test                       # build + test all packages + Rust tests

# Lint
pnpm lint

# Deploy changes to installed app (Windows)
# 1. Build desktop
pnpm --filter @pi-desktop/desktop run build
# 2. Use @electron/asar to extract → overwrite → repack
# asar located at: node_modules/.pnpm/@electron+asar@*/node_modules/@electron/asar/bin/asar.js
# target: C:\Users\Admin\AppData\Local\Programs\PI-Desktop\resources\app.asar
```

## Common Patterns & Gotchas

### Avoid Main Process Blocking
Never do synchronous I/O in `electron/main/index.ts`. Use `fsp.readFile`, `fsp.readdir`, `fsp.stat`.
Add `await new Promise(r => setImmediate(r))` between heavy file reads.

### Windows Path Compatibility
- Test assertions: always `.replaceAll("\\", "/")` before `.endsWith()` checks
- Script paths from `new URL(...)`: use `fileURLToPath()` before passing to `spawnSync`
- `path.relative()` output: `.split(path.sep).join('/')` for cross-platform

### pnpm Scripts
All recursive scripts must exclude root: `--filter "!pi-desktop"`.
Docs excluded from typecheck: `--filter "!@pi-desktop/docs"`.

### Tab Icons
When adding new tab kinds in `WorkPanel.tsx`, add to `TAB_ICONS` const:
```typescript
const TAB_ICONS = { review, file, plugin, "todo-plan" } as const;
```

### Markdown Component
Uses `source` prop, NOT `content`: `<Markdown source={...} />`

### Planning & Todo Workflow Rule
- For complex, difficult, long, or multi-feature tasks (affecting multiple files/subsystems): ALWAYS formulate and submit an implementation plan FIRST (`EnterPlanMode` / `SubmitPlan`) before modifying code.
- Only after the user approves the plan should the agent generate a Todo list and begin systematic execution.
- Small or straightforward fixes may proceed directly with the standard workflow.

## Performance Notes

### Token Usages (statsGetModelUsageSummary)
- Uses mtime+size cache (`sessionUsageScanCache` Map in main process) to skip unchanged files
- Pre-filters JSONL lines with `'"usage"'` substring before JSON.parse
- Async reads + `setImmediate` yield between files — never blocks
- Renderer has 1-second debounce on `onSessionsChanged` refresh (silent=true, no spinner flash)

## Search Tips for This Codebase

- IPC handlers: search `handle(IPC.invoke.` in `electron/main/index.ts`
- Store actions: search `create(` or `useStore` in `src/stores/`
- Component styles: search in `src/styles/` or co-located `.css` files
- Test failures from CSS class names: check `src/styles/settings.css` + `src/components/settings/`
- Rust errors: check `crates/host-core/src/`

## Skills to Use Proactively

- Use `smart_search` / `smart_outline` / `smart_unfold` (mcp plugin) for efficient symbol lookup before reading whole files
- Use `Explore` agent for multi-file search ("where is X defined", "which files reference Y")
- Use `Plan` agent before implementing complex features
- Use `Grep` over `Bash grep` — it's faster and permission-safe
- Prefer `Edit` over `Write` for modifying existing files

## Deployment

Installed app: `C:\Users\Admin\AppData\Local\Programs\PI-Desktop\`
Resources: `C:\Users\Admin\AppData\Local\Programs\PI-Desktop\resources\app.asar`

To hot-patch without reinstalling:
1. Extract `app.asar` → temp dir
2. Overwrite `out/` with new build
3. Repack → overwrite `app.asar`
4. Restart PI-Desktop
