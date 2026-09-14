import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { IPC, type ModelUsageDailyItem, type ModelUsageSummaryItem, type ModelUsageSummaryResult, type TimeframeKey, type TimeframeUsageItem } from "@pi-desktop/shared";
import type { HostProcess } from "../host-process";
import type { Logger } from "../logger";
import type { ModelsDevCatalog } from "../models-dev-catalog";
import type { PersistenceOutbox } from "../persistence-outbox";
import type { IpcRegistrar } from "./types";

export type UsagesIpcDependencies = {
  dataDir: string;
  modelsDevCatalog: ModelsDevCatalog;
  persistenceOutbox?: PersistenceOutbox;
  logger: Pick<Logger, "app">;
  getHost: () => HostProcess | null;
};

type SessionUsageScanCacheEntry = {
  mtimeMs: number;
  size: number;
  records: Array<{ modelId: string; u: any; rawCreated: string }>;
};

const sessionUsageScanCache = new Map<string, SessionUsageScanCacheEntry>();
let sessionUsageScanCacheLoaded = false;
let sessionUsageCacheDebounceTimer: NodeJS.Timeout | null = null;

let cachedModelUsageSummary: ModelUsageSummaryResult | null = null;
let cachedModelUsageSummaryTimestamp = 0;
const MODEL_USAGE_CACHE_TTL_MS = 10_000;
let inFlightModelUsageSummaryPromise: Promise<ModelUsageSummaryResult> | null = null;

export function invalidateModelUsageSummaryCache(): void {
  cachedModelUsageSummary = null;
  cachedModelUsageSummaryTimestamp = 0;
}

export function registerUsagesIpc(
  registrar: IpcRegistrar,
  dependencies: UsagesIpcDependencies,
) {
  const { dataDir, modelsDevCatalog, persistenceOutbox, logger, getHost } = dependencies;
  const { handle } = registrar;

  async function loadSessionUsageScanCache(): Promise<void> {
    if (sessionUsageScanCacheLoaded) return;
    sessionUsageScanCacheLoaded = true;
    try {
      const cacheFile = join(dataDir, "cache", "token-usage-cache.json");
      if (existsSync(cacheFile)) {
        const content = await readFile(cacheFile, "utf8");
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === "object") {
          for (const [key, val] of Object.entries(parsed)) {
            if (
              val &&
              typeof val === "object" &&
              typeof (val as any).mtimeMs === "number" &&
              Array.isArray((val as any).records)
            ) {
              sessionUsageScanCache.set(key, val as SessionUsageScanCacheEntry);
            }
          }
        }
      }
    } catch (err) {
      logger.app("session", "warn", "failed to load session usage scan cache", { data: String(err) });
    }
  }

  async function saveSessionUsageScanCacheNow(): Promise<void> {
    if (sessionUsageCacheDebounceTimer) {
      clearTimeout(sessionUsageCacheDebounceTimer);
      sessionUsageCacheDebounceTimer = null;
    }
    try {
      const cacheDir = join(dataDir, "cache");
      if (!existsSync(cacheDir)) {
        await mkdir(cacheDir, { recursive: true });
      }
      const data: Record<string, SessionUsageScanCacheEntry> = {};
      for (const [key, val] of sessionUsageScanCache.entries()) {
        data[key] = val;
      }
      await writeFile(join(cacheDir, "token-usage-cache.json"), JSON.stringify(data), "utf8");
    } catch (err) {
      logger.app("session", "warn", "failed to save session usage scan cache", { data: String(err) });
    }
  }

  const modelRateCache = new Map<
    string,
    { input: number; output: number; cacheRead: number; cacheWrite: number }
  >();

  const BASE_RATES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
    // Google Gemini
    "gemini-3.8-flash": { input: 0.15, output: 0.60, cacheRead: 0.0375, cacheWrite: 0 },
    "gemini-3.7-flash": { input: 0.15, output: 0.60, cacheRead: 0.0375, cacheWrite: 0 },
    "gemini-3.7-flash-tiered": { input: 0.15, output: 0.60, cacheRead: 0.0375, cacheWrite: 0 },
    "gemini-3.6-flash": { input: 0.15, output: 0.60, cacheRead: 0.0375, cacheWrite: 0 },
    "gemini-3.6-flash-tiered": { input: 0.15, output: 0.60, cacheRead: 0.0375, cacheWrite: 0 },
    "gemini-2.5-flash": { input: 0.15, output: 0.60, cacheRead: 0.0375, cacheWrite: 0 },
    "gemini-2.0-flash": { input: 0.10, output: 0.40, cacheRead: 0.025, cacheWrite: 0 },
    "gemini-1.5-flash": { input: 0.075, output: 0.30, cacheRead: 0.01875, cacheWrite: 0 },
    "gemini-1.5-pro": { input: 1.25, output: 5.00, cacheRead: 0.3125, cacheWrite: 0 },
    // Anthropic Claude
    "claude-sonnet-4-6": { input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 3.75 },
    "claude-3-7-sonnet": { input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 3.75 },
    "claude-3-5-sonnet": { input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 3.75 },
    "claude-opus-4-6": { input: 15.00, output: 75.00, cacheRead: 1.50, cacheWrite: 18.75 },
    "claude-opus-4-6-thinking": { input: 15.00, output: 75.00, cacheRead: 1.50, cacheWrite: 18.75 },
    "claude-3-opus": { input: 15.00, output: 75.00, cacheRead: 1.50, cacheWrite: 18.75 },
    "claude-haiku-4-5": { input: 1.00, output: 5.00, cacheRead: 0.10, cacheWrite: 1.25 },
    "claude-3-5-haiku": { input: 0.80, output: 4.00, cacheRead: 0.08, cacheWrite: 1.00 },
    // OpenAI GPT
    "gpt-4o": { input: 2.50, output: 10.00, cacheRead: 1.25, cacheWrite: 0 },
    "gpt-4o-mini": { input: 0.15, output: 0.60, cacheRead: 0.075, cacheWrite: 0 },
    "gpt-4-turbo": { input: 10.00, output: 30.00, cacheRead: 0, cacheWrite: 0 },
    "gpt-4": { input: 30.00, output: 60.00, cacheRead: 0, cacheWrite: 0 },
    "gpt-3.5-turbo": { input: 0.50, output: 1.50, cacheRead: 0, cacheWrite: 0 },
    "o1": { input: 15.00, output: 60.00, cacheRead: 7.50, cacheWrite: 0 },
    "o1-mini": { input: 1.10, output: 4.40, cacheRead: 0.55, cacheWrite: 0 },
    "o3": { input: 2.00, output: 8.00, cacheRead: 0.50, cacheWrite: 0 },
    "o3-mini": { input: 1.10, output: 4.40, cacheRead: 0.55, cacheWrite: 0 },
    "o4-mini": { input: 1.10, output: 4.40, cacheRead: 0.275, cacheWrite: 0 },
    "gpt-5.6-sol": { input: 4.00, output: 20.00, cacheRead: 0.40, cacheWrite: 5.00 },
    "gpt-5.6-terra": { input: 2.00, output: 12.00, cacheRead: 0.20, cacheWrite: 2.50 },
    "gpt-5.6-luna": { input: 0.20, output: 1.20, cacheRead: 0.02, cacheWrite: 0.25 },
    "gpt-5.4": { input: 2.50, output: 15.00, cacheRead: 0.25, cacheWrite: 0 },
    "gpt-5.4-mini": { input: 0.75, output: 4.50, cacheRead: 0.075, cacheWrite: 0 },
    "gpt-5-mini": { input: 0.25, output: 2.00, cacheRead: 0.025, cacheWrite: 0 },
    "gpt-5": { input: 1.25, output: 10.00, cacheRead: 0.125, cacheWrite: 0 },
    // DeepSeek
    "deepseek-chat": { input: 0.14, output: 0.28, cacheRead: 0.014, cacheWrite: 0 },
    "deepseek-v3": { input: 0.14, output: 0.28, cacheRead: 0.014, cacheWrite: 0 },
    "deepseek-reasoner": { input: 0.55, output: 2.19, cacheRead: 0.14, cacheWrite: 0 },
    "deepseek-r1": { input: 0.55, output: 2.19, cacheRead: 0.14, cacheWrite: 0 },
    "deepseek-v4": { input: 0.14, output: 0.28, cacheRead: 0.014, cacheWrite: 0 },
    "deepseek-v4-flash": { input: 0.14, output: 0.28, cacheRead: 0.014, cacheWrite: 0 },
    // Moonshot Kimi
    "kimi-k2.5": { input: 0.60, output: 3.00, cacheRead: 0.12, cacheWrite: 0 },
    "kimi-k2.7-code": { input: 0.95, output: 4.00, cacheRead: 0.19, cacheWrite: 0 },
    "kimi-k3": { input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 0 },
    // Zhipu GLM
    "glm-4.7": { input: 0.60, output: 2.20, cacheRead: 0.12, cacheWrite: 0 },
    "glm-5": { input: 0.95, output: 3.15, cacheRead: 0.20, cacheWrite: 0 },
    "glm-5.1": { input: 1.30, output: 4.30, cacheRead: 0.26, cacheWrite: 0 },
    "glm-5.2": { input: 1.40, output: 4.40, cacheRead: 0.30, cacheWrite: 0 },
    "glm-5.3": { input: 1.40, output: 4.40, cacheRead: 0.14, cacheWrite: 0 },
    "glm-5.3-flash": { input: 0.15, output: 0.50, cacheRead: 0.03, cacheWrite: 0 },
    // Qwen / Alibaba
    "qwen3.8-27b": { input: 0.45, output: 3.20, cacheRead: 0.05, cacheWrite: 0 },
    "qwen3-30b": { input: 0.05, output: 0.33, cacheRead: 0.01, cacheWrite: 0 },
    "qwen2.5-72b": { input: 0.35, output: 1.40, cacheRead: 0.07, cacheWrite: 0 },
    // Meta Llama
    "llama-3.3-70b": { input: 0.60, output: 2.40, cacheRead: 0.12, cacheWrite: 0 },
    "llama-3.1-405b": { input: 2.00, output: 6.00, cacheRead: 0.50, cacheWrite: 0 },
    "llama-4-scout": { input: 0.27, output: 0.85, cacheRead: 0.05, cacheWrite: 0 },
    // Grok
    "grok-4.5": { input: 2.00, output: 6.00, cacheRead: 0.50, cacheWrite: 0 },
    "grok-4.6": { input: 2.00, output: 6.00, cacheRead: 0.50, cacheWrite: 0 },
  };

  function resolveRate(modelId: string) {
    if (!modelId) return { input: 1.00, output: 4.00, cacheRead: 0.1, cacheWrite: 0 };
    const cached = modelRateCache.get(modelId);
    if (cached) return cached;
    const clean = modelId.trim().toLowerCase();
    const shortId = clean.includes("/") ? clean.split("/").pop()! : clean;

    let rate: { input: number; output: number; cacheRead: number; cacheWrite: number } | null = null;
    const catalogHit = modelsDevCatalog.findModel({ modelId });
    if (catalogHit?.cost) {
      rate = {
        input: catalogHit.cost.input ?? 1.00,
        output: catalogHit.cost.output ?? 4.00,
        cacheRead: catalogHit.cost.cacheRead ?? 0.1,
        cacheWrite: catalogHit.cost.cacheWrite ?? 0,
      };
    } else if (BASE_RATES[clean]) {
      rate = BASE_RATES[clean];
    } else if (BASE_RATES[shortId]) {
      rate = BASE_RATES[shortId];
    } else {
      for (const [k, v] of Object.entries(BASE_RATES)) {
        if (shortId.includes(k) || k.includes(shortId)) {
          rate = v;
          break;
        }
      }
    }

    if (!rate) {
      rate = { input: 1.00, output: 4.00, cacheRead: 0.1, cacheWrite: 0 };
    }
    modelRateCache.set(modelId, rate);
    return rate;
  }

  function computeCost(
    usage: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number },
    rates: { input: number; output: number; cacheRead: number; cacheWrite: number },
  ) {
    const inp = ((usage.inputTokens || 0) * (rates.input || 0)) / 1e6;
    const out = ((usage.outputTokens || 0) * (rates.output || 0)) / 1e6;
    const cr = ((usage.cacheReadTokens || 0) * (rates.cacheRead || 0)) / 1e6;
    const cw = ((usage.cacheWriteTokens || 0) * (rates.cacheWrite || 0)) / 1e6;
    return inp + out + cr + cw;
  }

  type Acc = {
    inputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: number;
    turnCount: number;
    modelStats: Record<string, any>;
  };

  function createAcc(): Acc {
    return {
      inputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      turnCount: 0,
      modelStats: {},
    };
  }

  function toLocalDateStr(dateInput?: string | number | Date): string {
    if (!dateInput) {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    if (typeof dateInput === "string") {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput);
      if (m) return dateInput;
    }
    const d = typeof dateInput === "object" ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function normalizeModelKey(raw: string): string {
    if (!raw) return "unknown";
    let m = raw.trim().toLowerCase();
    if (m.startsWith("ag/")) m = m.slice(3);
    else if (m.startsWith("google/")) m = m.slice(7);
    else if (m.startsWith("anthropic/")) m = m.slice(10);
    else if (m.startsWith("openai/")) m = m.slice(7);
    else if (m.includes("/")) m = m.split("/").pop()!;
    return m;
  }

  handle(
    IPC.invoke.statsGetModelUsageSummary,
    async (input?: { force?: boolean }): Promise<ModelUsageSummaryResult> => {
      const nowMs = Date.now();
      if (
        !input?.force &&
        cachedModelUsageSummary &&
        nowMs - cachedModelUsageSummaryTimestamp < MODEL_USAGE_CACHE_TTL_MS
      ) {
        return cachedModelUsageSummary;
      }
      if (!input?.force && inFlightModelUsageSummaryPromise) {
        return inFlightModelUsageSummaryPromise;
      }

      inFlightModelUsageSummaryPromise = (async () => {
        try {
          await loadSessionUsageScanCache();
          const sessionsDir = join(dataDir, "sessions");
          const now = Date.now();
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayStartMs = todayStart.getTime();
          const sevenDaysMs = now - 7 * 86400 * 1000;
          const thirtyDaysMs = now - 30 * 86400 * 1000;
          const sixtyDaysMs = now - 60 * 86400 * 1000;

          const accMap: Record<TimeframeKey, Acc> = {
            today: createAcc(),
            sevenDays: createAcc(),
            thirtyDays: createAcc(),
            sixtyDays: createAcc(),
            allTime: createAcc(),
          };

          const dailyMap: Record<string, ModelUsageDailyItem> = {};

          function addRecord(acc: Acc, modelId: string, u: any, cost: number) {
            const inp = u.inputTokens || u.input || 0;
            const out = u.outputTokens || u.output || 0;
            const cr = u.cacheReadTokens || u.cacheRead || 0;
            const cw = u.cacheWriteTokens || u.cacheWrite || 0;
            const tot = u.totalTokens || (inp + out + cr + cw);

            acc.inputTokens += inp;
            acc.outputTokens += out;
            acc.cacheReadTokens += cr;
            acc.cacheWriteTokens += cw;
            acc.totalTokens += tot;
            acc.costUsd += cost;
            acc.turnCount += 1;

            if (!acc.modelStats[modelId]) {
              acc.modelStats[modelId] = {
                modelId,
                inputTokens: 0,
                outputTokens: 0,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
                cacheTokens: 0,
                totalTokens: 0,
                costUsd: 0,
                turnCount: 0,
                rates: resolveRate(modelId),
              };
            }
            const m = acc.modelStats[modelId];
            m.inputTokens += inp;
            m.outputTokens += out;
            m.cacheReadTokens += cr;
            m.cacheWriteTokens += cw;
            m.cacheTokens += (cr + cw);
            m.totalTokens += tot;
            m.costUsd += cost;
            m.turnCount += 1;
          }

          function processExtractedItem(rawModelId: string, u: any, rawCreated: string) {
            const modelId = normalizeModelKey(rawModelId);
            const ts = rawCreated ? new Date(rawCreated).getTime() : now;
            const dateStr = toLocalDateStr(rawCreated || now);
            const rates = resolveRate(modelId);
            const cost = computeCost(u, rates);

            addRecord(accMap.allTime, modelId, u, cost);
            if (ts >= sixtyDaysMs) addRecord(accMap.sixtyDays, modelId, u, cost);
            if (ts >= thirtyDaysMs) addRecord(accMap.thirtyDays, modelId, u, cost);
            if (ts >= sevenDaysMs) addRecord(accMap.sevenDays, modelId, u, cost);
            if (ts >= todayStartMs) addRecord(accMap.today, modelId, u, cost);

            const inp = u.inputTokens || u.input || 0;
            const out = u.outputTokens || u.output || 0;
            const cr = u.cacheReadTokens || u.cacheRead || 0;
            const cw = u.cacheWriteTokens || u.cacheWrite || 0;
            const tot = u.totalTokens || (inp + out + cr + cw);

            if (!dailyMap[dateStr]) {
              dailyMap[dateStr] = {
                date: dateStr,
                timestamp: ts,
                inputTokens: 0,
                cacheTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                turnCount: 0,
                costUsd: 0,
              };
            }
            dailyMap[dateStr].inputTokens += inp;
            dailyMap[dateStr].cacheTokens += (cr + cw);
            dailyMap[dateStr].outputTokens += out;
            dailyMap[dateStr].totalTokens += tot;
            dailyMap[dateStr].costUsd += cost;
            dailyMap[dateStr].turnCount += 1;
          }

          let hasNewScannedFiles = false;
          if (existsSync(sessionsDir)) {
            try {
              const files = (await readdir(sessionsDir)).filter(
                (f) => f.endsWith(".jsonl") && !f.includes(".revisions.")
              );
              for (const file of files) {
                const filePath = join(sessionsDir, file);
                try {
                  const fileStat = await stat(filePath);
                  const cached = sessionUsageScanCache.get(file);
                  if (cached && cached.mtimeMs === fileStat.mtimeMs && cached.size === fileStat.size) {
                    for (const r of cached.records) {
                      processExtractedItem(r.modelId, r.u, r.rawCreated);
                    }
                    continue;
                  }

                  if (fileStat.size === 0 || fileStat.size > 50 * 1024 * 1024) continue;

                  const extractedRecords: Array<{ modelId: string; u: any; rawCreated: string }> = [];
                  const content = await readFile(filePath, "utf8");
                  let startIdx = 0;
                  let scanOps = 0;
                  while ((startIdx = content.indexOf('"usage"', startIdx)) !== -1) {
                    scanOps++;
                    if (scanOps % 500 === 0) {
                      await new Promise((resolve) => setImmediate(resolve));
                    }
                    const lineStart = content.lastIndexOf("\n", startIdx) + 1;
                    let lineEnd = content.indexOf("\n", startIdx);
                    if (lineEnd === -1) lineEnd = content.length;
                    const line = content.slice(lineStart, lineEnd);
                    try {
                      const rec = JSON.parse(line);
                      if (rec.type === "message" && rec.role === "assistant") {
                        const u = rec.meta?.usage || rec.usage;
                        if (u) {
                          const modelId = rec.meta?.modelId || rec.modelId || "unknown";
                          const rawCreated = rec.createdAt || rec.created_at || "";
                          const item = { modelId, u, rawCreated };
                          extractedRecords.push(item);
                          processExtractedItem(modelId, u, rawCreated);
                        }
                      }
                    } catch {}
                    startIdx = lineEnd + 1;
                  }

                  sessionUsageScanCache.set(file, {
                    mtimeMs: fileStat.mtimeMs,
                    size: fileStat.size,
                    records: extractedRecords,
                  });
                  hasNewScannedFiles = true;

                  // Yield after each scanned file to keep UI responsive
                  await new Promise((resolve) => setImmediate(resolve));
                } catch {}
              }
            } catch {}
          }

          // Also scan unpersisted assistant messages from the outbox for live accuracy
          try {
            const outboxEntries = persistenceOutbox?.getEntries?.() ?? [];
            for (const entry of outboxEntries) {
              const msg = entry.message as any;
              if (msg && (msg.role === "assistant" || msg.type === "message")) {
                const u = msg.meta?.usage || msg.usage;
                if (u) {
                  const modelId = msg.meta?.modelId || msg.modelId || "unknown";
                  const rawCreated = msg.createdAt || msg.created_at || "";
                  processExtractedItem(modelId, u, rawCreated);
                }
              }
            }
          } catch {}

          if (hasNewScannedFiles) {
            await saveSessionUsageScanCacheNow();
          }

          function formatTimeframe(id: TimeframeKey, labelKey: string, acc: Acc): TimeframeUsageItem {
            const modelsList = (Object.values(acc.modelStats) as ModelUsageSummaryItem[]).sort(
              (a, b) => b.totalTokens - a.totalTokens
            );
            const total = acc.totalTokens || 1;
            modelsList.forEach((m) => {
              m.percent = Math.round((m.totalTokens / total) * 100);
            });

            return {
              id,
              labelKey,
              inputTokens: acc.inputTokens,
              cacheReadTokens: acc.cacheReadTokens,
              cacheWriteTokens: acc.cacheWriteTokens,
              cacheTokens: acc.cacheReadTokens + acc.cacheWriteTokens,
              outputTokens: acc.outputTokens,
              totalTokens: acc.totalTokens,
              costUsd: acc.costUsd,
              turnCount: acc.turnCount,
              models: modelsList,
            };
          }

          const timeframes: Record<TimeframeKey, TimeframeUsageItem> = {
            today: formatTimeframe("today", "settings.usageToday", accMap.today),
            sevenDays: formatTimeframe("sevenDays", "settings.usage7Days", accMap.sevenDays),
            thirtyDays: formatTimeframe("thirtyDays", "settings.usage1Month", accMap.thirtyDays),
            sixtyDays: formatTimeframe("sixtyDays", "settings.usage2Months", accMap.sixtyDays),
            allTime: formatTimeframe("allTime", "settings.usageAllTime", accMap.allTime),
          };

          const models = timeframes.allTime.models;
          const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

          const result: ModelUsageSummaryResult = {
            timeframes,
            models,
            daily,
          };
          cachedModelUsageSummary = result;
          cachedModelUsageSummaryTimestamp = Date.now();
          return result;
        } finally {
          inFlightModelUsageSummaryPromise = null;
        }
      })();

      return inFlightModelUsageSummaryPromise;
    },
  );
}
