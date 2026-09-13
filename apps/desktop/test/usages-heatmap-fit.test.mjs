import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const usagesPage = await readFile(
  new URL("../src/components/settings/UsagesPage.tsx", import.meta.url),
  "utf8",
);
const css = await readFile(
  new URL("../src/styles/settings.css", import.meta.url),
  "utf8",
);

test("Contribution Graph uses responsive SVG without scrollbars", () => {
  // Must render SVG with viewBox
  assert.match(usagesPage, /<svg[^>]*viewBox=/);
  assert.match(usagesPage, /className="token-usage-heatmap-svg"/);
  // Must render month labels
  assert.match(usagesPage, /monthLabels\.map/);
  assert.match(usagesPage, /token-usage-svg-label/);
  // Must render weekday labels Mon, Wed, Fri
  assert.match(usagesPage, /settings\.usageMon/);
  assert.match(usagesPage, /settings\.usageWed/);
  assert.match(usagesPage, /settings\.usageFri/);
  // Must NOT have overflow-x: auto in heatmap layout
  assert.doesNotMatch(css, /\.token-usage-heatmap-layout\s*\{[^}]*overflow-x:\s*auto/);
  // Must have overflow: hidden
  assert.match(css, /\.token-usage-heatmap-layout\s*\{[^}]*overflow:\s*hidden/);
  assert.match(css, /\.token-usage-heatmap-svg\s*\{[^}]*width:\s*100%/);
});
