import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  ModelUsageSummaryItem,
  ModelUsageSummaryResult,
  TimeframeUsageItem,
  TokenUsageHistoryItem,
} from "@pi-desktop/shared";
import { api } from "../../lib/api";
import { IconActivity, IconBot } from "../icons";
import { useAppStore } from "../../stores/app-store";
import {
  formatTokenCount,
  mergeUsageDailyAndHistory,
  buildContinuousCalendarGrid,
  type HeatmapCalendarCell,
} from "../../lib/model-pricing";

function cellFill(value: number, max: number): string {
  if (value <= 0) return "var(--ds-tile)";
  const ratio = Math.min(value / Math.max(max, 1), 1);
  const mix = Math.round(28 + ratio * 72);
  return `color-mix(in oklab, var(--ds-success) ${mix}%, transparent)`;
}

export function UsagesPage() {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [summary, setSummary] = useState<ModelUsageSummaryResult | null>(null);
  const [historyItems, setHistoryItems] = useState<TokenUsageHistoryItem[]>([]);
  const [selectedCell, setSelectedCell] = useState<{
    date: string;
    total: number;
    input: number;
    output: number;
    cost?: number;
    turns?: number;
    models?: Record<
      string,
      {
        totalTokens: number;
        costUsd: number;
        inputTokens: number;
        outputTokens: number;
      }
    >;
  } | null>(null);

  const draftConfiguration = useAppStore((s) => s.draftConfiguration);
  const settings = useAppStore((s) => s.settings);
  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeModelId =
    activeSession?.modelId ||
    draftConfiguration?.modelId ||
    settings?.defaultModelId ||
    "gemini-3.8-flash";

  const inFlightRef = useRef(false);
  const loadData = async (silent = false) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (!silent) setLoading(true);
    setError(false);
    try {
      const [sumRes, histRes] = await Promise.all([
        api.getModelUsageSummary().catch(() => null),
        api.getTokenUsageHistory({ bucket: "day" }).catch(() => null),
      ]);
      if (sumRes) setSummary(sumRes);
      if (histRes?.items) {
        setHistoryItems(histRes.items);
      }
      setSelectedCell(null);
    } catch {
      setError(true);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();

    // Auto-refresh when sessions / messages update (debounced by 1s)
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = api.onSessionsChanged(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void loadData(true);
      }, 1000);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, []);

  // Mode All-time by default
  const allTimeData: TimeframeUsageItem = useMemo(() => {
    if (summary?.timeframes?.allTime) {
      return summary.timeframes.allTime;
    }
    return {
      id: "allTime",
      labelKey: "settings.usageAllTime",
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
  }, [summary?.timeframes]);

  // Models across all time
  const allModels: ModelUsageSummaryItem[] = useMemo(() => {
    if (summary?.models && summary.models.length > 0) {
      return summary.models;
    }
    if (allTimeData.models && allTimeData.models.length > 0) {
      return allTimeData.models;
    }
    return [];
  }, [summary?.models, allTimeData.models]);

  // Top 5 models for the right-hand overview
  const topModels = useMemo(() => {
    return allModels.slice(0, 5);
  }, [allModels]);

  // Continuous 53-week heatmap calendar data merged by local date string
  const mergedMap = useMemo(() => {
    return mergeUsageDailyAndHistory(summary?.daily ?? [], historyItems ?? []);
  }, [summary?.daily, historyItems]);

  const { weeks, monthLabels, maxTokens } = useMemo(() => {
    return buildContinuousCalendarGrid(mergedMap, new Date(), i18n.language);
  }, [mergedMap, i18n.language]);

  const hasAnyTokens = useMemo(() => {
    for (const v of mergedMap.values()) {
      if ((v.totalTokens || 0) > 0) return true;
    }
    return false;
  }, [mergedMap]);

  const svgWidth = Math.max(28 + weeks.length * 13 + 6, 728);
  const svgHeight = 112;

  const totalCache =
    allTimeData.cacheTokens ||
    allTimeData.cacheReadTokens + allTimeData.cacheWriteTokens;

  return (
    <div className="usages-page">
      {/* Top Header */}
      <div className="token-usage-toolbar">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            {t("settings.usages")}
          </h2>
        </div>
      </div>

      {/* Main Dashboard Grid: Lifetime KPIs (left) & Active/Top Models (right) */}
      <div className="token-usage-dashboard-grid">
        {/* Left Column: 4 Lifetime Stat Cards */}
        <div className="token-usage-stat-cards">
          {/* Lifetime Input Tokens */}
          <div className="token-usage-card">
            <div className="text-xs font-medium text-text-muted">
              {t("settings.usageInputTokens")}
            </div>
            <div className="mt-2 text-2xl font-bold text-text-primary font-mono">
              {formatTokenCount(allTimeData.inputTokens)}
            </div>
            <div className="mt-1 text-xs text-text-muted font-mono">
              {allTimeData.inputTokens.toLocaleString()} tokens
            </div>
          </div>

          {/* Lifetime Cache Tokens */}
          <div className="token-usage-card">
            <div className="text-xs font-medium text-text-muted flex items-center justify-between">
              <span>{t("settings.usageCacheTokens")}</span>
              <span className="token-dot cache" />
            </div>
            <div className="mt-2 text-2xl font-bold text-sky-400 font-mono">
              {formatTokenCount(totalCache)}
            </div>
            <div className="mt-1 text-xs text-text-muted font-mono">
              {totalCache.toLocaleString()} tokens
            </div>
          </div>

          {/* Lifetime Output Tokens */}
          <div className="token-usage-card">
            <div className="text-xs font-medium text-text-muted flex items-center justify-between">
              <span>{t("settings.usageOutputTokens")}</span>
              <span className="token-dot output" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-400 font-mono">
              {formatTokenCount(allTimeData.outputTokens)}
            </div>
            <div className="mt-1 text-xs text-text-muted font-mono">
              {allTimeData.outputTokens.toLocaleString()} tokens
            </div>
          </div>

          {/* Lifetime Total Cost USD */}
          <div className="token-usage-card highlight">
            <div className="text-xs font-medium text-text-muted">
              {t("settings.usageTotalCost")}
            </div>
            <div className="mt-2 text-2xl font-bold text-ds-accent font-mono">
              ${allTimeData.costUsd.toFixed(4)}
            </div>
            <div className="mt-1 text-xs text-text-muted">
              {t("settings.usageAllTime")} USD
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
              <span className="token-badge-active">
                {t("settings.usageStatusActive")}
              </span>
            </div>
            <div className="mt-1.5 text-sm font-semibold text-text-primary font-mono truncate">
              {activeModelId}
            </div>
          </div>

          {/* Top Models ranking for all time */}
          <div className="token-usage-top-models-box">
            <div className="text-xs font-medium text-text-muted mb-2">
              {t("settings.usageTopModels")}
            </div>
            <div className="flex flex-col gap-2.5">
              {topModels.length === 0 ? (
                <div className="py-2 text-xs text-text-muted">
                  {t("settings.usageEmpty")}
                </div>
              ) : (
                topModels.map((m) => {
                  const pct =
                    m.percent ??
                    Math.round(
                      (m.totalTokens / (allTimeData.totalTokens || 1)) * 100,
                    );
                  return (
                    <div key={m.modelId} className="token-usage-model-rank-item">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span
                          className="font-mono text-text-primary truncate max-w-[130px]"
                          title={m.modelId}
                        >
                          {m.modelId.split("/").pop()}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-text-secondary">
                            {formatTokenCount(m.totalTokens)}
                          </span>
                          <span className="text-ds-accent font-mono text-xs-plus">
                            ${m.costUsd.toFixed(3)}
                          </span>
                        </div>
                      </div>
                      <div className="token-progress-bar-bg">
                        <div
                          className="token-progress-bar-fill"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
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
            <span
              className="token-usage-swatch"
              style={{ backgroundColor: cellFill(1, 4) }}
            />
            <span
              className="token-usage-swatch"
              style={{ backgroundColor: cellFill(2, 4) }}
            />
            <span
              className="token-usage-swatch"
              style={{ backgroundColor: cellFill(3, 4) }}
            />
            <span
              className="token-usage-swatch"
              style={{ backgroundColor: cellFill(4, 4) }}
            />
            <span>{t("settings.usageMore")}</span>
          </div>
        </div>

        {error ? (
          <div className="py-10 text-center text-xs text-text-muted">
            {t("settings.usageLoadError")}
          </div>
        ) : loading && !summary ? (
          <div className="py-10 text-center text-xs text-text-muted">
            {t("settings.usageEmpty")}
          </div>
        ) : !hasAnyTokens ? (
          <div className="py-10 text-center text-xs text-text-muted">
            {t("settings.usageEmpty")}
          </div>
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

              <text x="0" y="27" className="token-usage-svg-label">
                {t("settings.usageMon")}
              </text>
              <text x="0" y="53" className="token-usage-svg-label">
                {t("settings.usageWed")}
              </text>
              <text x="0" y="79" className="token-usage-svg-label">
                {t("settings.usageFri")}
              </text>

              {weeks.map((week, colIdx) => {
                const colX = 28 + colIdx * 13;
                return (
                  <g key={`col-${colIdx}`}>
                    {week.map((item, rowIdx) => {
                      if (!item) return null;
                      const cellY = 18 + rowIdx * 13;
                      const isSelected = selectedCell?.date === item.date;

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
                            opacity: 1,
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
                              models: item.models,
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
          <div
            className="token-usage-detail text-xs text-text-primary"
            style={{ display: "flex", flexDirection: "column", gap: "6px" }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                alignItems: "center",
              }}
            >
              <span className="font-semibold">{selectedCell.date}</span>
              {selectedCell.turns !== undefined ? (
                <span className="text-text-muted">
                  {t("settings.usageTurns")}:{" "}
                  {selectedCell.turns.toLocaleString()}
                </span>
              ) : null}
              <span>
                {t("settings.usageInput")}:{" "}
                {selectedCell.input.toLocaleString()}
              </span>
              <span>
                {t("settings.usageOutput")}:{" "}
                {selectedCell.output.toLocaleString()}
              </span>
              <span>
                {t("settings.usageTotal")}:{" "}
                {selectedCell.total.toLocaleString()}
              </span>
              {selectedCell.cost !== undefined ? (
                <span className="font-medium text-ds-accent">
                  {t("settings.usageCostUsd")}: ${selectedCell.cost.toFixed(4)}
                </span>
              ) : null}
            </div>
            {selectedCell.models &&
            Object.keys(selectedCell.models).length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginTop: "4px",
                }}
              >
                {Object.entries(selectedCell.models).map(([mId, mData]) => (
                  <span
                    key={mId}
                    className="token-usage-model-tag"
                    style={{ fontSize: "11px", padding: "2px 6px" }}
                  >
                    <strong>{mId}</strong>: {formatTokenCount(mData.totalTokens)}{" "}
                    (${mData.costUsd.toFixed(4)})
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Per-Model Usage Breakdown Table (All-Time Lifetime History) */}
      <div className="token-usage-card-block">
        <h3 className="token-usage-card-heading">
          {t("settings.usageModels")} ({t("settings.usageAllTime")})
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
              {allModels.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-6 text-center text-xs text-text-muted"
                  >
                    {t("settings.usageEmpty")}
                  </td>
                </tr>
              ) : (
                allModels.map((m: ModelUsageSummaryItem) => (
                  <tr key={m.modelId}>
                    <td className="font-medium">
                      <span className="token-usage-model-tag">{m.modelId}</span>
                    </td>
                    <td className="text-right text-xs text-text-muted">
                      ${m.rates?.input ?? 1} / ${m.rates?.output ?? 4}
                    </td>
                    <td className="text-right font-mono">
                      {m.inputTokens.toLocaleString()}
                    </td>
                    <td className="text-right font-mono text-sky-400">
                      {(
                        m.cacheTokens ??
                        m.cacheReadTokens + m.cacheWriteTokens
                      ).toLocaleString()}
                    </td>
                    <td className="text-right font-mono text-emerald-400">
                      {m.outputTokens.toLocaleString()}
                    </td>
                    <td className="text-right font-mono font-semibold">
                      {m.totalTokens.toLocaleString()}
                    </td>
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
