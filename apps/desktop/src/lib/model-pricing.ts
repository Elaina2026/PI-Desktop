export type ModelRate = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

export const BASE_MODEL_RATES: Record<string, ModelRate> = {
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

export function resolveModelRate(modelId?: string | null): ModelRate {
  if (!modelId) return { input: 1.0, output: 4.0, cacheRead: 0.1, cacheWrite: 0 };
  const clean = modelId.trim().toLowerCase();
  const shortId = clean.includes("/") ? clean.split("/").pop()! : clean;

  if (BASE_MODEL_RATES[clean]) return BASE_MODEL_RATES[clean];
  if (BASE_MODEL_RATES[shortId]) return BASE_MODEL_RATES[shortId];

  for (const [k, v] of Object.entries(BASE_MODEL_RATES)) {
    if (shortId.includes(k) || k.includes(shortId)) return v;
  }

  return { input: 1.0, output: 4.0, cacheRead: 0.1, cacheWrite: 0 };
}

export function computeTokenCost(
  usage: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number },
  rates: ModelRate,
): number {
  const inp = ((usage.inputTokens || 0) * rates.input) / 1e6;
  const out = ((usage.outputTokens || 0) * rates.output) / 1e6;
  const cr = ((usage.cacheReadTokens || 0) * rates.cacheRead) / 1e6;
  const cw = ((usage.cacheWriteTokens || 0) * rates.cacheWrite) / 1e6;
  return inp + out + cr + cw;
}

export function formatTokenCount(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

export function formatYMD(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseLocalMidnightMs(dateStr: string): number {
  if (!dateStr || typeof dateStr !== "string") return 0;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (m) {
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

export function toLocalDateStr(dateInput?: string | number | Date): string {
  if (!dateInput) {
    const d = new Date();
    return formatYMD(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  if (typeof dateInput === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput);
    if (m) return dateInput;
  }
  const d = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  return formatYMD(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export type HeatmapCalendarCell = {
  date: string;
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd?: number;
  turnCount?: number;
  models?: Record<
    string,
    {
      totalTokens: number;
      costUsd: number;
      inputTokens: number;
      outputTokens: number;
    }
  >;
};

export function mergeUsageDailyAndHistory(
  daily: Array<{
    date: string;
    timestamp?: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    turnCount?: number;
    costUsd?: number;
    models?: Record<
      string,
      {
        totalTokens: number;
        costUsd: number;
        inputTokens: number;
        outputTokens: number;
      }
    >;
  }> = [],
  history: Array<{
    date: string;
    timestamp?: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    turnCount?: number;
    costUsd?: number;
  }> = [],
): Map<string, HeatmapCalendarCell> {
  const map = new Map<string, HeatmapCalendarCell>();

  for (const item of daily) {
    const key = toLocalDateStr(item.date || item.timestamp);
    if (!key) continue;
    map.set(key, {
      date: key,
      timestamp: item.timestamp ?? parseLocalMidnightMs(key),
      inputTokens: item.inputTokens ?? 0,
      outputTokens: item.outputTokens ?? 0,
      totalTokens: item.totalTokens ?? ((item.inputTokens ?? 0) + (item.outputTokens ?? 0)),
      costUsd: item.costUsd ?? 0,
      turnCount: item.turnCount ?? 0,
      models: item.models ? { ...item.models } : undefined,
    });
  }

  for (const item of history) {
    const key = toLocalDateStr(item.date || item.timestamp);
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      existing.inputTokens = Math.max(existing.inputTokens, item.inputTokens ?? 0);
      existing.outputTokens = Math.max(existing.outputTokens, item.outputTokens ?? 0);
      existing.totalTokens = Math.max(existing.totalTokens, item.totalTokens ?? 0);
      if (item.timestamp && !existing.timestamp) {
        existing.timestamp = item.timestamp;
      }
      if (existing.costUsd === undefined && item.costUsd !== undefined) {
        existing.costUsd = item.costUsd;
      }
      if (existing.turnCount === undefined && item.turnCount !== undefined) {
        existing.turnCount = item.turnCount;
      }
    } else {
      map.set(key, {
        date: key,
        timestamp: item.timestamp ?? parseLocalMidnightMs(key),
        inputTokens: item.inputTokens ?? 0,
        outputTokens: item.outputTokens ?? 0,
        totalTokens: item.totalTokens ?? ((item.inputTokens ?? 0) + (item.outputTokens ?? 0)),
        costUsd: item.costUsd,
        turnCount: item.turnCount,
      });
    }
  }

  return map;
}

export function buildContinuousCalendarGrid(
  mergedMap: Map<string, HeatmapCalendarCell>,
  refDate: Date = new Date(),
  locale: string = "en-US",
): {
  weeks: Array<Array<HeatmapCalendarCell>>;
  monthLabels: Array<{ col: number; name: string; x: number }>;
  maxTokens: number;
} {
  // ponytail: End fixed to local current week Sunday | Add arbitrary start/end date range controls when custom query view is introduced
  const d = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const dayOfWeek = d.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const monIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const daysUntilSunday = 6 - monIndex;

  const endSunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysUntilSunday);
  const startMonday = new Date(endSunday.getFullYear(), endSunday.getMonth(), endSunday.getDate() - 370);

  const weeks: Array<Array<HeatmapCalendarCell>> = [];
  let maxTokens = 1;

  for (let w = 0; w < 53; w++) {
    const week: Array<HeatmapCalendarCell> = [];
    for (let day = 0; day < 7; day++) {
      const offsetDays = w * 7 + day;
      const cellDate = new Date(startMonday.getFullYear(), startMonday.getMonth(), startMonday.getDate() + offsetDays);
      const dateStr = formatYMD(cellDate.getFullYear(), cellDate.getMonth() + 1, cellDate.getDate());
      const existing = mergedMap.get(dateStr);
      const cell: HeatmapCalendarCell = existing
        ? { ...existing }
        : {
            date: dateStr,
            timestamp: cellDate.getTime(),
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            costUsd: 0,
            turnCount: 0,
          };
      if (cell.totalTokens > maxTokens) {
        maxTokens = cell.totalTokens;
      }
      week.push(cell);
    }
    weeks.push(week);
  }

  const monthLabels: Array<{ col: number; name: string; x: number }> = [];
  let lastM = -1;
  weeks.forEach((week, col) => {
    for (const cell of week) {
      const parts = cell.date.split("-").map(Number);
      const m = parts[1];
      if (m !== undefined && !isNaN(m) && m !== lastM) {
        const monthDate = new Date(parts[0], m - 1, 1);
        let name = "";
        try {
          name = monthDate.toLocaleDateString(locale, { month: "short" });
        } catch {
          name = monthDate.toLocaleDateString("en-US", { month: "short" });
        }
        monthLabels.push({ col, name, x: 28 + col * 13 });
        lastM = m;
        break;
      }
    }
  });

  return { weeks, monthLabels, maxTokens };
}
