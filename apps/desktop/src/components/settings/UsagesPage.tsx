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
import { IconActivity, IconReview } from "../icons";

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

export function UsagesPage() {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [summary, setSummary] = useState<ModelUsageSummaryResult | null>(null);
  const [historyItems, setHistoryItems] = useState<TokenUsageHistoryItem[]>([]);
  const [activeTimeframe, setActiveTimeframe] = useState<string>("allTime");
  const [selectedCell, setSelectedCell] = useState<{
    date: string;
    total: number;
    input: number;
    output: number;
    cost?: number;
    turns?: number;
  } | null>(null);

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
  }, []);

  const timeframeList: TimeframeUsageItem[] = useMemo(() => {
    if (!summary?.timeframes) {
      return [
        { id: "today", labelKey: "settings.usageToday", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, costUsd: 0, turnCount: 0 },
        { id: "sevenDays", labelKey: "settings.usage7Days", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, costUsd: 0, turnCount: 0 },
        { id: "thirtyDays", labelKey: "settings.usage1Month", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, costUsd: 0, turnCount: 0 },
        { id: "sixtyDays", labelKey: "settings.usage2Months", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, costUsd: 0, turnCount: 0 },
        { id: "allTime", labelKey: "settings.usageAllTime", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, costUsd: 0, turnCount: 0 },
      ];
    }
    return [
      summary.timeframes.today,
      summary.timeframes.sevenDays,
      summary.timeframes.thirtyDays,
      summary.timeframes.sixtyDays,
      summary.timeframes.allTime,
    ];
  }, [summary]);

  // Build 53 columns x 7 rows for SVG
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

  // Calculate cutoff for active timeframe filter
  const timeframeCutoffMs = useMemo(() => {
    const now = Date.now();
    if (activeTimeframe === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    if (activeTimeframe === "sevenDays") return now - 7 * 86400 * 1000;
    if (activeTimeframe === "thirtyDays") return now - 30 * 86400 * 1000;
    if (activeTimeframe === "sixtyDays") return now - 60 * 86400 * 1000;
    return 0; // allTime
  }, [activeTimeframe]);

  const models = summary?.models ?? [];
  const svgWidth = Math.max(28 + weeks.length * 13 + 6, 725);
  const svgHeight = 112;

  return (
    <div className="token-usage-page">
      <div className="token-usage-toolbar">
        <h2 className="text-lg font-semibold text-text-primary">{t("settings.usages")}</h2>
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

      {/* 5 Timeframe KPI Cards */}
      <div className="token-usage-kpis" role="radiogroup" aria-label={t("settings.usageTimeframes")}>
        {timeframeList.map((tf) => {
          const isActive = activeTimeframe === tf.id;
          return (
            <button
              key={tf.id}
              type="button"
              className={`token-usage-kpi ${isActive ? "active" : ""}`}
              onClick={() => setActiveTimeframe(tf.id)}
              aria-pressed={isActive}
            >
              <div className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t(tf.labelKey)}
              </div>
              <div className="mt-1 text-lg font-semibold text-text-primary">
                {tf.totalTokens.toLocaleString()} <span className="text-xs font-normal text-text-muted">tokens</span>
              </div>
              <div className="mt-1 text-sm font-medium text-ds-accent">
                ${tf.costUsd.toFixed(4)} <span className="text-xs text-text-muted">USD</span>
              </div>
            </button>
          );
        })}
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
              {/* Month Labels along top */}
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

              {/* Weekday Labels along left */}
              <text x="0" y="27" className="token-usage-svg-label">{t("settings.usageMon")}</text>
              <text x="0" y="53" className="token-usage-svg-label">{t("settings.usageWed")}</text>
              <text x="0" y="79" className="token-usage-svg-label">{t("settings.usageFri")}</text>

              {/* Contribution Grid */}
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
                <th className="text-right">{t("settings.usageTableOutput")}</th>
                <th className="text-right">{t("settings.usageTableTotal")}</th>
                <th className="text-right">{t("settings.usageTableCost")}</th>
              </tr>
            </thead>
            <tbody>
              {timeframeList.map((tf) => (
                <tr
                  key={tf.id}
                  className={activeTimeframe === tf.id ? "bg-ds-tile/40 font-medium" : ""}
                >
                  <td className="font-medium">{t(tf.labelKey)}</td>
                  <td className="text-right font-mono">{tf.inputTokens.toLocaleString()}</td>
                  <td className="text-right font-mono">{tf.outputTokens.toLocaleString()}</td>
                  <td className="text-right font-mono font-semibold">{tf.totalTokens.toLocaleString()}</td>
                  <td className="text-right font-mono font-semibold text-ds-accent">
                    ${tf.costUsd.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Model Usage Breakdown Table */}
      <div className="token-usage-card-block">
        <h3 className="token-usage-card-heading">{t("settings.usageModels")}</h3>
        <div className="token-usage-table-wrap">
          <table className="token-usage-table">
            <thead>
              <tr>
                <th>{t("settings.usageModelName")}</th>
                <th className="text-right">{t("settings.usageRate")}</th>
                <th className="text-right">{t("settings.usageTableInput")}</th>
                <th className="text-right">{t("settings.usageTableOutput")}</th>
                <th className="text-right">{t("settings.usageTableTotal")}</th>
                <th className="text-right">{t("settings.usageTableCost")}</th>
              </tr>
            </thead>
            <tbody>
              {models.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-xs text-text-muted">
                    {t("settings.usageEmpty")}
                  </td>
                </tr>
              ) : (
                models.map((m: ModelUsageSummaryItem) => (
                  <tr key={m.modelId}>
                    <td className="font-medium">
                      <span className="token-usage-model-tag">{m.modelId}</span>
                    </td>
                    <td className="text-right text-xs text-text-muted">
                      ${m.rates?.input ?? 1} / ${m.rates?.output ?? 4}
                    </td>
                    <td className="text-right font-mono">{m.inputTokens.toLocaleString()}</td>
                    <td className="text-right font-mono">{m.outputTokens.toLocaleString()}</td>
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
