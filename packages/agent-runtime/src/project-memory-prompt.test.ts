import { describe, expect, it } from "vitest";
import {
  consolidateDreamMemory,
  projectMemoryPrompt,
  scoreMemoryEntry,
  selectRelevantMemory,
  splitMemoryEntries,
} from "./project-memory-prompt.js";

describe("projectMemoryPrompt", () => {
  it("omits blank memory and trims saved content", () => {
    expect(projectMemoryPrompt("  \n\t")).toBeUndefined();
    expect(projectMemoryPrompt("  Keep the API stable.  ")).toContain(
      "Keep the API stable.",
    );
  });

  it("marks memory as user-provided context", () => {
    const prompt = projectMemoryPrompt("Use the staging database.");
    expect(prompt).toContain("# Project memory");
    expect(prompt).toContain("user-provided context");
    expect(prompt).toContain("Use the staging database.");
  });

  it("selectively injects relevant memory entries when content exceeds 4000 characters", () => {
    const filler = "This is general background information to expand memory length. ".repeat(20);
    const dbEntry = `---
name: staging-database
description: Staging database credentials and connection info
metadata:
  type: reference
---
Postgres database runs at staging-db.internal:5432.
**Why:** Docker compose service configuration.
**How to apply:** Use port 5432 in staging connection strings.`;

    const cssEntry = `---
name: css-design-tokens
description: CSS variables from tokens.css
metadata:
  type: project
---
Never use raw hex colors. Always use CSS variables from tokens.css.
**Why:** Dark mode theme switching support.
**How to apply:** Reference var(--color-*) in component styles.`;

    const largeContent = [dbEntry, cssEntry, filler, filler, filler, filler].join("\n\n");
    expect(largeContent.length).toBeGreaterThan(4000);

    const promptForDb = projectMemoryPrompt(largeContent, "How to configure staging database connection?");
    expect(promptForDb).toContain("staging-database");
    expect(promptForDb).toContain("staging-db.internal:5432");
    expect(promptForDb).not.toContain("css-design-tokens");

    const promptForCss = projectMemoryPrompt(largeContent, "Fix button styling with CSS design tokens");
    expect(promptForCss).toContain("css-design-tokens");
    expect(promptForCss).toContain("var(--color-*)");
    expect(promptForCss).not.toContain("staging-database");
  });

  it("remains backward compatible without query", () => {
    const content = "## Rule 1\nAlways write tests.\n\n## Rule 2\nKeep diffs minimal.";
    const prompt = projectMemoryPrompt(content);
    expect(prompt).toContain("## Rule 1");
    expect(prompt).toContain("## Rule 2");
  });
});

describe("selectRelevantMemory", () => {
  const sampleMemory = `---
name: auth-token-header
description: Custom auth token header for API requests
metadata:
  type: reference
---
API client requires X-Auth-Token header instead of Authorization.
**Why:** Legacy gateway proxy requirement.
**How to apply:** Include X-Auth-Token in all fetch requests.

---
name: vitest-test-runner
description: Vitest test runner for monorepo packages
metadata:
  type: project
---
Run tests using pnpm --filter with vitest, not jest.
**Why:** Jest is not installed in the packages.
**How to apply:** Use vitest CLI commands.

---
name: z-index-modal
description: Modal overlay z-index stacking rule
metadata:
  type: project
---
Modal overlays must use var(--z-modal) from tokens.css.
**Why:** Prevents overlay clipping behind desktop chrome.
**How to apply:** Set z-index on dialog components.`;

  it("splits entries and scores by keyword frequency", () => {
    const result = selectRelevantMemory(sampleMemory, "How do I run package tests with vitest?");
    expect(result).toContain("vitest-test-runner");
    expect(result).not.toContain("auth-token-header");
    expect(result).not.toContain("z-index-modal");
  });

  it("prioritizes exact symbol matches", () => {
    const result = selectRelevantMemory(sampleMemory, "Inspect the X-Auth-Token header");
    expect(result).toContain("auth-token-header");
    expect(result).toContain("X-Auth-Token");
    expect(result).not.toContain("vitest-test-runner");
  });

  it("respects maxTokens budget", () => {
    const result = selectRelevantMemory(sampleMemory, "API token vitest modal", 40);
    // Budget of 40 tokens should only include the top-scoring entry
    const entries = splitMemoryEntries(result);
    expect(entries.length).toBe(1);
  });

  it("splits header-based memory entries correctly", () => {
    const headerMemory = `## Database Setup
Connect to postgres on port 5432 using DATABASE_URL.

## Build Scripts
Build all JS packages with pnpm build:js.`;

    const result = selectRelevantMemory(headerMemory, "Where is the postgres database connection?");
    expect(result).toContain("Database Setup");
    expect(result).toContain("DATABASE_URL");
    expect(result).not.toContain("Build Scripts");
  });

  it("returns all entries within budget when query is broad", () => {
    const result = selectRelevantMemory(sampleMemory, "");
    expect(result).toContain("auth-token-header");
    expect(result).toContain("vitest-test-runner");
  });
});

describe("consolidateDreamMemory", () => {
  it("extracts durable lessons into structured markdown records", () => {
    const history = [
      {
        role: "user",
        content: "Don't use jest in packages. That's wrong because this monorepo standardizes on vitest.",
      },
      {
        role: "assistant",
        content: "Understood, I will use vitest for all package tests.",
      },
      {
        role: "user",
        content: "In this codebase, never use raw hex colors. Always use CSS variables from tokens.css because hardcoded colors break dark mode.",
      },
      {
        role: "user",
        content: "I prefer functional components with hooks over class components.",
      },
      {
        role: "user",
        content: "The staging API endpoint is https://api-staging.internal:8443.",
      },
    ];

    const consolidated = consolidateDreamMemory(history);
    expect(consolidated).toContain("metadata:\n  type: feedback");
    expect(consolidated).toContain("metadata:\n  type: project");
    expect(consolidated).toContain("metadata:\n  type: user");
    expect(consolidated).toContain("metadata:\n  type: reference");
    expect(consolidated).toContain("**Why:**");
    expect(consolidated).toContain("**How to apply:**");
  });

  it("excludes transient task status, git commits, code dumps, and debug logs", () => {
    const history = [
      {
        role: "user",
        content: "Task status: completed. Step 3 of 3 finished. 14 passed tests.",
      },
      {
        role: "user",
        content: "commit 0b8a5683 feat: add features\nAuthor: dev <dev@example.com>\nDate: Mon Sep 15 2026",
      },
      {
        role: "assistant",
        content: "TypeError: Cannot read property 'map' of undefined\n    at renderList (app.js:42:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)",
      },
      {
        role: "user",
        content: "```typescript\ninterface Props {\n  name: string;\n}\nexport function App(props: Props) {\n  return <div>{props.name}</div>;\n}\n```",
      },
    ];

    const consolidated = consolidateDreamMemory(history);
    expect(consolidated).toBe("");
  });

  it("preserves preformatted dream memory records", () => {
    const record = `---
name: staging-port
description: Staging port is 9000
metadata:
  type: reference
---
The staging port is 9000.
**Why:** Avoids collision with local dev server.
**How to apply:** Set PORT=9000 in staging env.`;

    const history = [{ role: "assistant", content: record }];
    const consolidated = consolidateDreamMemory(history);
    expect(consolidated).toContain("name: staging-port");
    expect(consolidated).toContain("metadata:\n  type: reference");
    expect(consolidated).toContain("**Why:** Avoids collision with local dev server.");
  });
});
