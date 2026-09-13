import assert from "node:assert/strict";
import test from "node:test";
import {
  BASE_MODEL_RATES,
  resolveModelRate,
  computeTokenCost,
  formatTokenCount,
} from "../src/lib/model-pricing.ts";

test("resolveModelRate handles known providers and prefixes", () => {
  const gemini = resolveModelRate("gemini-3.8-flash");
  assert.equal(gemini.input, 0.15);
  assert.equal(gemini.output, 0.60);

  const claudeSonnet = resolveModelRate("ag/claude-sonnet-4-6");
  assert.equal(claudeSonnet.input, 3.00);
  assert.equal(claudeSonnet.output, 15.00);

  const gpt4o = resolveModelRate("openai/gpt-4o");
  assert.equal(gpt4o.input, 2.50);
  assert.equal(gpt4o.output, 10.00);

  const deepseek = resolveModelRate("deepseek-ai/deepseek-v4-flash");
  assert.equal(deepseek.input, 0.14);
  assert.equal(deepseek.output, 0.28);

  const unknown = resolveModelRate("some-random-unknown-model");
  assert.equal(unknown.input, 1.00);
  assert.equal(unknown.output, 4.00);
});

test("computeTokenCost computes USD accurately including cache", () => {
  const rates = { input: 2.00, output: 10.00, cacheRead: 0.50, cacheWrite: 0 };
  const usage = { inputTokens: 1_000_000, outputTokens: 500_000, cacheReadTokens: 2_000_000 };
  const cost = computeTokenCost(usage, rates);
  assert.equal(cost, 8.00);
});

test("formatTokenCount formats K, M, B accurately", () => {
  assert.equal(formatTokenCount(500), "500");
  assert.equal(formatTokenCount(1500), "1.5k");
  assert.equal(formatTokenCount(25000), "25k");
  assert.equal(formatTokenCount(2500000), "2.5M");
  assert.equal(formatTokenCount(3500000000), "3.50B");
});
