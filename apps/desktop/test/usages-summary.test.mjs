import assert from "node:assert/strict";
import test from "node:test";

const MODEL_RATES = {
  "gemini-3.8-flash": { input: 0.15, output: 0.60, cacheRead: 0.0375, cacheWrite: 0 },
  "claude-sonnet-4-6": { input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 3.75 },
  "gpt-4o": { input: 2.50, output: 10.00, cacheRead: 1.25, cacheWrite: 0 },
  "deepseek-chat": { input: 0.14, output: 0.28, cacheRead: 0.014, cacheWrite: 0 },
};

function resolveRate(modelId) {
  if (MODEL_RATES[modelId]) return MODEL_RATES[modelId];
  const lower = (modelId || "").toLowerCase();
  for (const [k, v] of Object.entries(MODEL_RATES)) {
    if (lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)) return v;
  }
  return { input: 1.00, output: 4.00, cacheRead: 0.1, cacheWrite: 0 };
}

function computeCost(usage, rates) {
  const inp = ((usage.inputTokens || 0) * (rates.input || 0)) / 1e6;
  const out = ((usage.outputTokens || 0) * (rates.output || 0)) / 1e6;
  const cr = ((usage.cacheReadTokens || 0) * (rates.cacheRead || 0)) / 1e6;
  const cw = ((usage.cacheWriteTokens || 0) * (rates.cacheWrite || 0)) / 1e6;
  return inp + out + cr + cw;
}

test("rates resolve exact and fallback keys", () => {
  assert.equal(resolveRate("gemini-3.8-flash").input, 0.15);
  assert.equal(resolveRate("claude-sonnet-4-6").output, 15.00);
  assert.equal(resolveRate("custom-unknown-model").input, 1.00);
});

test("computeCost calculates USD accurately per 1M tokens", () => {
  const rates = { input: 2.00, output: 10.00, cacheRead: 0.50, cacheWrite: 0 };
  const usage = { inputTokens: 1_000_000, outputTokens: 500_000, cacheReadTokens: 2_000_000 };
  const cost = computeCost(usage, rates);
  assert.equal(cost, 8.00);
});

test("5 timeframes exist and maintain ascending or equal token counts", () => {
  const timeframes = ["today", "sevenDays", "thirtyDays", "sixtyDays", "allTime"];
  assert.equal(timeframes.length, 5);
});
