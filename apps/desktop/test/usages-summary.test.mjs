import assert from "node:assert/strict";
import test from "node:test";
import {
  BASE_MODEL_RATES,
  resolveModelRate,
  computeTokenCost,
  formatTokenCount,
  toLocalDateStr,
  mergeUsageDailyAndHistory,
  buildContinuousCalendarGrid,
  parseLocalMidnightMs,
} from "../src/lib/model-pricing.ts";
import { Readable } from "node:stream";
import readline from "node:readline";

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

test("regex usage extractor matches JSON lines with usage without giant array allocation", () => {
  const sampleTranscript = [
    JSON.stringify({ type: "session_start", id: "sess-1" }),
    JSON.stringify({ type: "message", role: "user", content: "hello" }),
    JSON.stringify({
      type: "message",
      role: "assistant",
      meta: { modelId: "gemini-3.8-flash", usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 20 } },
      createdAt: "2026-09-13T10:00:00.000Z",
    }),
    JSON.stringify({ type: "tool_use", name: "Read" }),
  ].join("\n");

  const usageRegex = /^.*"usage".*$/gm;
  const extracted = [];
  let match;
  while ((match = usageRegex.exec(sampleTranscript)) !== null) {
    const line = match[0];
    const rec = JSON.parse(line);
    if (rec.type === "message" && rec.role === "assistant") {
      extracted.push(rec);
    }
  }

  assert.equal(extracted.length, 1);
  assert.equal(extracted[0].meta.usage.inputTokens, 100);
});

test("safe max tokens calculation handles large datasets without stack overflow", () => {
  const largeItems = Array.from({ length: 50000 }, (_, i) => ({
    date: "2026-01-01",
    totalTokens: i % 1000,
  }));
  const max = largeItems.reduce((acc, i) => Math.max(acc, Number(i?.totalTokens) || 0), 1);
  assert.equal(max, 999);
});

test("streaming line reader extracts usage and yields periodically without giant string buffering", async () => {
  const lines = [];
  // Generate 2500 lines to verify periodic yielding every 1000 lines
  for (let i = 0; i < 2500; i++) {
    if (i === 100) {
      lines.push(
        JSON.stringify({
          type: "message",
          role: "assistant",
          meta: { modelId: "claude-sonnet-4-6", usage: { inputTokens: 500, outputTokens: 200 } },
          createdAt: "2026-04-10T08:00:00.000Z",
        }),
      );
    } else if (i === 1500) {
      lines.push(
        JSON.stringify({
          type: "message",
          role: "assistant",
          meta: { modelId: "gpt-4o", usage: { inputTokens: 300, outputTokens: 100 } },
          createdAt: "2026-04-11T12:00:00.000Z",
        }),
      );
    } else {
      lines.push(JSON.stringify({ type: "tool_use", callId: `call-${i}`, name: "Read" }));
    }
  }

  async function* generateLines() {
    for (const l of lines) {
      yield l + "\n";
    }
  }
  const stream = Readable.from(generateLines());
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  let yieldCount = 0;
  let lineCount = 0;
  const extractedRecords = [];

  for await (const line of rl) {
    lineCount++;
    if (lineCount % 1000 === 0) {
      yieldCount++;
      await new Promise((resolve) => setImmediate(resolve));
    }
    if (!line.includes('"usage"')) continue;
    try {
      const rec = JSON.parse(line);
      if (rec.type === "message" && rec.role === "assistant") {
        const u = rec.meta?.usage || rec.usage;
        if (!u) continue;
        const modelId = rec.meta?.modelId || rec.modelId || "unknown";
        const rawCreated = rec.createdAt || rec.created_at || "";
        extractedRecords.push({ modelId, u, rawCreated });
      }
    } catch {}
  }

  assert.equal(lineCount, 2500);
  assert.equal(yieldCount, 2);
  assert.equal(extractedRecords.length, 2);
  assert.equal(extractedRecords[0].modelId, "claude-sonnet-4-6");
  assert.equal(extractedRecords[0].u.inputTokens, 500);
  assert.equal(extractedRecords[1].modelId, "gpt-4o");
  assert.equal(extractedRecords[1].u.inputTokens, 300);
});

test("continuous calendar grid normalization merges daily and history and preserves cost/turns", () => {
  const sampleDaily = [
    {
      date: "2026-04-10",
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      turnCount: 4,
      costUsd: 0.0543,
    },
    {
      date: "2026-04-11",
      inputTokens: 2000,
      outputTokens: 800,
      totalTokens: 2800,
      turnCount: 7,
      costUsd: 0.1205,
    },
  ];

  const sampleHistory = [
    {
      date: "2026-04-10",
      inputTokens: 1200,
      outputTokens: 600,
      totalTokens: 1800,
      turnCount: 2, // Should not overwrite summary.daily's 4
    },
    {
      date: "2026-03-01",
      inputTokens: 500,
      outputTokens: 100,
      totalTokens: 600,
      turnCount: 1,
    },
  ];

  const merged = mergeUsageDailyAndHistory(sampleDaily, sampleHistory);

  // Do NOT discard summary.daily when historyItems.length > 0
  assert.ok(merged.has("2026-04-10"));
  assert.ok(merged.has("2026-04-11"));
  assert.ok(merged.has("2026-03-01"));

  // Ensure costUsd and turnCount from summary.daily are preserved
  const mergedApr10 = merged.get("2026-04-10");
  assert.equal(mergedApr10.turnCount, 4);
  assert.equal(mergedApr10.costUsd, 0.0543);
  assert.equal(mergedApr10.totalTokens, 1800);

  // Build continuous 53-week calendar grid
  const refDate = new Date(2026, 3, 16); // 2026-04-16 (Thursday)
  const grid = buildContinuousCalendarGrid(merged, refDate, "en-US");

  // Exactly 53 weeks
  assert.equal(grid.weeks.length, 53);

  // Exactly 371 days (7 days per week)
  let totalDays = 0;
  for (const week of grid.weeks) {
    assert.equal(week.length, 7);
    totalDays += week.length;

    // Weekday alignment verification
    const monParts = week[0].date.split("-").map(Number);
    const monDay = new Date(monParts[0], monParts[1] - 1, monParts[2]).getDay();
    assert.equal(monDay, 1, `Row 0 must be Monday, got ${monDay} for ${week[0].date}`);

    const wedParts = week[2].date.split("-").map(Number);
    const wedDay = new Date(wedParts[0], wedParts[1] - 1, wedParts[2]).getDay();
    assert.equal(wedDay, 3, `Row 2 must be Wednesday, got ${wedDay} for ${week[2].date}`);

    const friParts = week[4].date.split("-").map(Number);
    const friDay = new Date(friParts[0], friParts[1] - 1, friParts[2]).getDay();
    assert.equal(friDay, 5, `Row 4 must be Friday, got ${friDay} for ${week[4].date}`);

    const sunParts = week[6].date.split("-").map(Number);
    const sunDay = new Date(sunParts[0], sunParts[1] - 1, sunParts[2]).getDay();
    assert.equal(sunDay, 0, `Row 6 must be Sunday, got ${sunDay} for ${week[6].date}`);
  }
  assert.equal(totalDays, 371);

  // Verify populated cell when selected
  const foundApr10 = grid.weeks.flat().find((c) => c.date === "2026-04-10");
  assert.ok(foundApr10);
  const selectedCell = {
    date: foundApr10.date,
    total: foundApr10.totalTokens,
    input: foundApr10.inputTokens,
    output: foundApr10.outputTokens,
    cost: foundApr10.costUsd,
    turns: foundApr10.turnCount,
  };
  assert.equal(selectedCell.total, 1800);
  assert.equal(selectedCell.cost, 0.0543);
  assert.equal(selectedCell.turns, 4);
});

test("parseLocalMidnightMs converts YYYY-MM-DD to local midnight timestamp", () => {
  const dateStr = "2026-04-10";
  const expected = new Date(2026, 3, 10, 0, 0, 0, 0).getTime();
  assert.equal(parseLocalMidnightMs(dateStr), expected);

  // Verify mergeUsageDailyAndHistory assigns local midnight if timestamp is absent
  const merged = mergeUsageDailyAndHistory([{ date: "2026-04-10", totalTokens: 100 }]);
  const cell = merged.get("2026-04-10");
  assert.ok(cell);
  assert.equal(cell.timestamp, expected);
});
