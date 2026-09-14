import { readSettingsSource } from "./helpers/source-contracts.mjs";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const search = await readFile(
  new URL("../src/lib/settings-search.ts", import.meta.url),
  "utf8",
);
const settingsPage = await readSettingsSource();
const api = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");

test("settings has usages destination and API methods", () => {
  assert.match(search, /id: "usages"/);
  assert.match(search, /settings\.nav\.usages/);
  assert.match(settingsPage, /UsagesPage/);
  assert.match(settingsPage, /tab === "usages"|settingsTab === "usages"/);
  assert.match(api, /getTokenUsageHistory/);
  assert.match(api, /getModelUsageSummary/);
});

test("settings UsagesPage component exists", async () => {
  await access(
    new URL("../src/components/settings/UsagesPage.tsx", import.meta.url),
    constants.F_OK,
  );
});
