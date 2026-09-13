import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  ModelUsageSummaryItem,
  ModelUsageSummaryResult,
  TimeframeUsageItem,
  TokenUsageHistoryItem,
} from "@pi-desktop/shared";
import { api } from "../../lib/api";
import { Button } from "../ui";
import { IconActivity, IconBot, IconReview } from "../icons";
import { useAppStore } from "../../stores/app-store";
import { formatTokenCount } from "../../lib/model-pricing";

function cellFill(value: number, max: number): string {
  if (value <= 0) return "var(--ds-tile)";
  const ratio = Math.min(value / Math.max(max, 1), 1);
  const mix = Math.round(28 + ratio * 72);
  return `color-mix(in oklab, var(--ds-success) ${mix}%, transparent)`;
}

function mondayIndex(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const weekday = new Date(year, month - 1, day).getDay();
  return weekday === 0 ? 6 : weekday - 1;
}

type TimeframeKey = "today" | "sevenDays" | "thirtyDays" | "allTime";

export function UsagesPage() {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [summary, setSummary] = useState<ModelUsageSummaryResult | null>(null);
  const [historyItems, setHistoryItems] = useState<TokenUsageHistoryItem[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeKey>("sevenDays");
  const [selectedCell, setSelectedCell] = useState<{
    date: string;
    total: number;
    input: number;
    output: number;
    cost?: number;
    turns?: number;
  } | null>(null);

  const draftConfiguration = useAppStore((s) => s.draftConfiguration);
  const settings = useAppStore((s) => s.settings);
  const activeModelId =
    draftConfiguration?.modelId ||
    settings?.defaultModelId ||
    "gemini-3.8-flash";

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const [sumRes, histRes] = await Promise.all([
        api.getModelUsageSummary().catch(() => null),
        api.getTokenUsageHistory({ bucket: "day" }).catch(() => null),
      ]);
      setSummary(sumRes);
      if (histRes?.items) {
        setHistoryItems(histRes.items);
      }
      setSelectedCell(null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();

    // Auto-refresh when sessions / messages update
    return api.onSessionsChanged(() => {
      void loadData();
    });
  }, []);

  const timeframesMap = summary?.timeframes;
  const currentTfData: TimeframeUsageItem = useMemo(() => {
    if (timeframesMap && timeframesMap[selectedTimeframe]) {
      return timeframesMap[selectedTimeframe];
    }
    return {
      id: selectedTimeframe,
      labelKey: `settings.usage${selectedTimeframe}`,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      cacheTokens: 0,
      totalTokens: 0,
      turnCount: 0,
      costUsd: 0,
      models: [],
    };
  }, [timeframesMap, selectedTimeframe]);

  // Models used in selected timeframe (or allTime)
  const currentModels: ModelUsageSummaryItem[] = useMemo(() => {
    if (currentTfData.models && currentTfData.models.length > 0) {
      return currentTfData.models;
    }
    return summary?.models ?? [];
  }, [currentTfData, summary]);

  // Top 5 models for the right-hand panel
  const topModels = useMemo(() => {
    return currentModels.slice(0, 5);
  }, [currentModels]);

  // Contribution graph data
  const rawItems = historyItems.length > 0 ? historyItems : (summary?.daily ?? []);

  const { weeks, monthLabels, maxTokens } = useMemo(() => {
    if (!rawItems.length) {
      return { weeks: [], monthLabels: [], maxTokens: 1 };
    }

    const pad = mondayIndex(rawItems[0].date);
    const padded: Array<any | null> = [...Array(pad).fill(null), ...rawItems];

    const wks: Array<Array<any | null>> = [];
    for (let i = 0; i < padded.length; i += 7) {
      wks.push(padded.slice(i, i + 7));
    }

    const max = Math.max(...rawItems.map((i: any) => i.totalTokens), 1);

    const labels: Array<{ col: number; name: string; x: number }> = [];
    let lastM = -1;
    wks.forEach((w, col) => {
      const day = w.find((d) => d !== null);
      if (day) {
        const [y, m] = day.date.split("-").map(Number);
        if (m !== lastM) {
          const d = new Date(y, m - 1, 1);
          let name = "";
          try {
            name = d.toLocaleDateString(i18n.language, { month: "short" });
          } catch {
            name = d.toLocaleDateString("en-US", { month: "short" });
          }
          labels.push({ col, name, x: 28 + col * 13 });
          lastM = m;
        }
      }
    });

    return { weeks: wks, monthLabels: labels, maxTokens: max };
  }, [rawItems, i18n.language]);

  const timeframeCutoffMs = useMemo(() => {
    const now = Date.now();
    if (selectedTimeframe === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    if (selectedTimeframe === "sevenDays") return now - 7 * 86400 * 1000;
    if (selectedTimeframe === "thirtyDays") return now - 30 * 86400 * 1000;
    return 0; // allTime
  }, [selectedTimeframe]);

  const svgWidth = Math.max(28 + weeks.length * 13 + 6, 728);
  const svgHeight = 112;

  const timeframeTabs: Array<{ id: TimeframeKey; labelKey: string }> = [
    { id: "today", labelKey: "settings.usageToday" },
    { id: "sevenDays", labelKey: "settings.usage7Days" },
    { id: "thirtyDays", labelKey: "settings.usage1Month" },
    { id: "allTime", labelKey: "settings.usageAllTime" },
  ];

  return (
    <div className="token-usage-page">
      {/* Top Header & Timeframe Selector Bar */}
      <div className="token-usage-toolbar">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{t("settings.usages")}</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Timeframe Selector Segment */}
          <div className="token-usage-timeframe-selector" role="tablist">
            {timeframeTabs.map((tab) => {
              const active = selectedTimeframe === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`token-usage-timeframe-btn ${active ? "active" : ""}`}
                  onClick={() => setSelectedTimeframe(tab.id)}
                >
                  {t(tab.labelKey)}
                </button>
              );
            })}
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => void loadData()}
            disabled={loading}
            aria-label={t("settings.usageRefresh")}
          >
            <IconReview className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {/* Main 9router-style Dashboard Grid: 4 KPIs (left) & Active/Top Models (right) */}
      <div className="token-usage-dashboard-grid">
        {/* Left Column: 4 Stat Cards */}
        <div className="token-usage-stat-cards">
          {/* Input Tokens */}
          <div className="token-usage-card">
            <div className="text-xs font-medium text-text-muted">
              {t("settings.usageInputTokens")}
            </div>
            <div className="mt-2 text-2xl font-bold text-text-primary font-mono">
              {formatTokenCount(currentTfData.inputTokens)}
            </div>
            <div className="mt-1 text-xs text-text-muted font-mono">
              {currentTfData.inputTokens.toLocaleString()} tokens
            </div>
          </div>

          {/* Cache Tokens */}
          <div className="token-usage-card">
            <div className="text-xs font-medium text-text-muted flex items-center justify-between">
              <span>{t("settings.usageCacheTokens")}</span>
              <span className="token-dot cache" />
            </div>
            <div className="mt-2 text-2xl font-bold text-sky-400 font-mono">
              {formatTokenCount(currentTfData.cacheTokens || (currentTfData.cacheReadTokens + currentTfData.cacheWriteTokens))}
            </div>
            <div className="mt-1 text-xs text-text-muted font-mono">
              {(currentTfData.cacheReadTokens + currentTfData.cacheWriteTokens).toLocaleString()} tokens
            </div>
          </div>

          {/* Output Tokens */}
          <div className="token-usage-card">
            <div className="text-xs font-medium text-text-muted flex items-center justify-between">
              <span>{t("settings.usageOutputTokens")}</span>
              <span className="token-dot output" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-400 font-mono">
              {formatTokenCount(currentTfData.outputTokens)}
            </div>
            <div className="mt-1 text-xs text-text-muted font-mono">
              {currentTfData.outputTokens.toLocaleString()} tokens
            </div>
          </div>

          {/* Total Cost USD */}
          <div className="token-usage-card highlight">
            <div className="text-xs font-medium text-text-muted">
              {t("settings.usageTotalCost")}
            </div>
            <div className="mt-2 text-2xl font-bold text-ds-accent font-mono">
              ${currentTfData.costUsd.toFixed(4)}
            </div>
            <div className="mt-1 text-xs text-text-muted">
              {t(timeframeTabs.find((x) => x.id === selectedTimeframe)?.labelKey || "")} USD
            </div>
          </div>
        </div>

        {/* Right Column: Active Model & Top Models Overview */}
        <div className="token-usage-models-overview">
          {/* Active Model */}
          <div className="token-usage-active-model-box">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted flex items-center gap-1.5">
                <IconBot size={13} />
                {t("settings.usageActiveModel")}
              </span>
              <span className="token-badge-active">{t("settings.usageStatusActive")}</span>
            </div>
            <div className="mt-1.5 text-sm font-semibold text-text-primary font-mono truncate">
              {activeModelId}
            </div>
          </div>

          {/* Top Models ranking for current timeframe */}
          <div className="token-usage-top-models-box">
            <div className="text-xs font-medium text-text-muted mb-2">
              {t("settings.usageTopModels")}
            </div>
            <div className="flex flex-col gap-2.5">
              {topModels.length === 0 ? (
                <div className="py-2 text-xs text-text-muted">{t("settings.usageEmpty")}</div>
              ) : (
                topModels.map((m) => {
                  const pct = m.percent ?? Math.round((m.totalTokens / (currentTfData.totalTokens || 1)) * 100);
                  return (
                    <div key={m.modelId} className="token-usage-model-rank-item">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono text-text-primary truncate max-w-[130px]" title={m.modelId}>
                          {m.modelId.split("/").pop()}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-text-secondary">{formatTokenCount(m.totalTokens)}</span>
                          <span className="text-ds-accent font-mono text-xs-plus">${m.costUsd.toFixed(3)}</span>
                        </div>
                      </div>
                      <div className="token-progress-bar-bg">
                        <div className="token-progress-bar-fill" style={{ width: `${Math.max(pct, 2)}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contribution Graph Heatmap Card */}
      <div className="token-usage-heatmap-card">
        <div className="token-usage-heatmap-header">
          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <IconActivity />
            {t("settings.usageActivity")}
          </div>
          <div className="token-usage-legend text-xs text-text-muted">
            <span>{t("settings.usageLess")}</span>
            <span className="token-usage-swatch" />
            <span className="token-usage-swatch" style={{ backgroundColor: cellFill(1, 4) }} />
            <span className="token-usage-swatch" style={{ backgroundColor: cellFill(2, 4) }} />
            <span className="token-usage-swatch" style={{ backgroundColor: cellFill(3, 4) }} />
            <span className="token-usage-swatch" style={{ backgroundColor: cellFill(4, 4) }} />
            <span>{t("settings.usageMore")}</span>
          </div>
        </div>

        {error ? (
          <div className="py-10 text-center text-xs text-text-muted">{t("settings.usageLoadError")}</div>
        ) : loading && !weeks.length ? (
          <div className="py-10 text-center text-xs text-text-muted">{t("settings.usageRefresh")}</div>
        ) : !rawItems.length || rawItems.every((item: any) => item.totalTokens === 0) ? (
          <div className="py-10 text-center text-xs text-text-muted">{t("settings.usageEmpty")}</div>
        ) : (
          <div className="token-usage-heatmap-layout">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="token-usage-heatmap-svg"
              role="grid"
              aria-label={t("settings.usageActivity")}
            >
              {monthLabels.map((m) => (
                <text
                  key={`${m.col}-${m.name}`}
                  x={m.x}
                  y="10"
                  className="token-usage-svg-label"
                >
                  {m.name}
                </text>
              ))}

              <text x="0" y="27" className="token-usage-svg-label">{t("settings.usageMon")}</text>
              <text x="0" y="53" className="token-usage-svg-label">{t("settings.usageWed")}</text>
              <text x="0" y="79" className="token-usage-svg-label">{t("settings.usageFri")}</text>

              {weeks.map((week, colIdx) => {
                const colX = 28 + colIdx * 13;
                return (
                  <g key={`col-${colIdx}`}>
                    {week.map((item, rowIdx) => {
                      if (!item) return null;
                      const cellY = 18 + rowIdx * 13;
                      const isSelected = selectedCell?.date === item.date;
                      const inActiveWindow =
                        timeframeCutoffMs === 0 ||
                        (item.timestamp ? item.timestamp >= timeframeCutoffMs : new Date(item.date).getTime() >= timeframeCutoffMs);

                      return (
                        <rect
                          key={item.date}
                          x={colX}
                          y={cellY}
                          width={10}
                          height={10}
                          rx={2}
                          ry={2}
                          className={`token-usage-svg-cell ${isSelected ? "selected" : ""}`}
                          style={{
                            fill: cellFill(item.totalTokens, maxTokens),
                            opacity: inActiveWindow ? 1 : 0.25,
                          }}
                          aria-pressed={isSelected}
                          onClick={() =>
                            setSelectedCell({
                              date: item.date,
                              total: item.totalTokens,
                              input: item.inputTokens,
                              output: item.outputTokens,
                              cost: item.costUsd,
                              turns: item.turnCount,
                            })
                          }
                        >
                          <title>
                            {t("settings.usageCell", {
                              date: item.date,
                              total: item.totalTokens.toLocaleString(),
                            })}
                          </title>
                        </rect>
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        {selectedCell ? (
          <div className="token-usage-detail text-xs text-text-primary">
            <span className="font-semibold">{selectedCell.date}</span>
            {selectedCell.turns !== undefined ? (
              <span className="text-text-muted">
                {t("settings.usageTurns")}: {selectedCell.turns.toLocaleString()}
              </span>
            ) : null}
            <span>
              {t("settings.usageInput")}: {selectedCell.input.toLocaleString()}
            </span>
            <span>
              {t("settings.usageOutput")}: {selectedCell.output.toLocaleString()}
            </span>
            <span>
              {t("settings.usageTotal")}: {selectedCell.total.toLocaleString()}
            </span>
            {selectedCell.cost !== undefined ? (
              <span className="font-medium text-ds-accent">
                {t("settings.usageCostUsd")}: ${selectedCell.cost.toFixed(4)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Timeframe Total Price Table */}
      <div className="token-usage-card-block">
        <h3 className="token-usage-card-heading">{t("settings.usageTimeframes")}</h3>
        <div className="token-usage-table-wrap">
          <table className="token-usage-table">
            <thead>
              <tr>
                <th>{t("settings.usageTableTimeframe")}</th>
                <th className="text-right">{t("settings.usageTableInput")}</th>
                <th className="text-right">{t("settings.usageCacheTokens")}</th>
                <th className="text-right">{t("settings.usageTableOutput")}</th>
                <th className="text-right">{t("settings.usageTableTotal")}</th>
                <th className="text-right">{t("settings.usageTableCost")}</th>
              </tr>
            </thead>
            <tbody>
              {timeframeTabs.map((tab) => {
                const tf = timeframesMap ? timeframesMap[tab.id] : null;
                const isCurrent = selectedTimeframe === tab.id;
                return (
                  <tr
                    key={tab.id}
                    className={isCurrent ? "bg-ds-tile/50 font-medium" : ""}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedTimeframe(tab.id)}
                  >
                    <td className="font-medium">
                      <span className="flex items-center gap-2">
                        {isCurrent ? <span className="w-1.5 h-1.5 rounded-full bg-ds-accent" /> : null}
                        {t(tab.labelKey)}
                      </span>
                    </td>
                    <td className="text-right font-mono">{(tf?.inputTokens ?? 0).toLocaleString()}</td>
                    <td className="text-right font-mono text-sky-400">
                      {((tf?.cacheTokens ?? ((tf?.cacheReadTokens ?? 0) + (tf?.cacheWriteTokens ?? 0)))).toLocaleString()}
                    </td>
                    <td className="text-right font-mono text-emerald-400">{(tf?.outputTokens ?? 0).toLocaleString()}</td>
                    <td className="text-right font-mono font-semibold">{(tf?.totalTokens ?? 0).toLocaleString()}</td>
                    <td className="text-right font-mono font-semibold text-ds-accent">
                      ${(tf?.costUsd ?? 0).toFixed(4)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Model Usage Breakdown Table */}
      <div className="token-usage-card-block">
        <h3 className="token-usage-card-heading">
          {t("settings.usageModels")} ({t(timeframeTabs.find((x) => x.id === selectedTimeframe)?.labelKey || "")})
        </h3>
        <div className="token-usage-table-wrap">
          <table className="token-usage-table">
            <thead>
              <tr>
                <th>{t("settings.usageModelName")}</th>
                <th className="text-right">{t("settings.usageRate")}</th>
                <th className="text-right">{t("settings.usageTableInput")}</th>
                <th className="text-right">{t("settings.usageCacheTokens")}</th>
                <th className="text-right">{t("settings.usageTableOutput")}</th>
                <th className="text-right">{t("settings.usageTableTotal")}</th>
                <th className="text-right">{t("settings.usageTableCost")}</th>
              </tr>
            </thead>
            <tbody>
              {currentModels.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-xs text-text-muted">
                    {t("settings.usageEmpty")}
                  </td>
                </tr>
              ) : (
                currentModels.map((m: ModelUsageSummaryItem) => (
                  <tr key={m.modelId}>
                    <td className="font-medium">
                      <span className="token-usage-model-tag">{m.modelId}</span>
                    </td>
                    <td className="text-right text-xs text-text-muted">
                      ${m.rates?.input ?? 1} / ${m.rates?.output ?? 4}
                    </td>
                    <td className="text-right font-mono">{m.inputTokens.toLocaleString()}</td>
                    <td className="text-right font-mono text-sky-400">
                      {(m.cacheTokens ?? (m.cacheReadTokens + m.cacheWriteTokens)).toLocaleString()}
                    </td>
                    <td className="text-right font-mono text-emerald-400">{m.outputTokens.toLocaleString()}</td>
                    <td className="text-right font-mono font-semibold">{m.totalTokens.toLocaleString()}</td>
                    <td className="text-right font-mono font-semibold text-ds-accent">
                      ${m.costUsd.toFixed(4)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
