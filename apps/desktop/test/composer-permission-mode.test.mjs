import { readComposerSource } from "./helpers/source-contracts.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const composerSource = await readComposerSource();

test("Unified mode selector presents all unified operating and permission modes", () => {
  const modeControlSource = composerSource.slice(
    composerSource.indexOf('className="composer-mode-anchor"'),
    composerSource.indexOf('<div className="composer-right">'),
  );

  assert.match(
    modeControlSource,
    /UNIFIED_MODES\.map\(\(candidate\)/,
  );
  assert.match(
    modeControlSource,
    /aria-checked=\{isSelected\}/,
  );
  assert.match(
    modeControlSource,
    /const isSelected = currentUnifiedId === candidate\.id;/,
  );
  assert.match(
    composerSource,
    /const composerPermissionMode: Exclude<PermissionMode, "inherit"> =\s*\n\s*mode === "goal" \? "auto" : effectivePermissionMode;/,
  );
});

test("Unified mode converts selection to session mode and permission mode", () => {
  assert.match(
    composerSource,
    /const targetConfig = unifiedModeToSessionConfig\(candidate\.id\);/,
  );
  assert.match(
    composerSource,
    /resolveUnifiedMode\(mode, composerPermissionMode\)/,
  );
});
