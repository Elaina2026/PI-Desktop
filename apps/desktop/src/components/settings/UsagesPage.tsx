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
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [summary, setSummary] = useState<ModelUsageSummaryResult | null>(null);
  const [historyItems, setHistoryItems] = useState<TokenUsageHistoryItem[]>([]);
  const [selectedCell, setSelectedCell] = useState<{ date: string; total: number; input: number; output: number; cost?: number; turns?: number } | null>(null);

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

  const dailyCells = useMemo(() => {
    if (historyItems.length > 0) {
      const pad = mondayIndex(historyItems[0].date);
      return [...Array<TokenUsageHistoryItem | null>(pad).fill(null), ...historyItems];
    }
    if (summary?.daily?.length) {
      const pad = mondayIndex(summary.daily[0].date);
      return [...Array<any | null>(pad).fill(null), ...summary.daily];
    }
    return null;
  }, [historyItems, summary]);

  const maxTokens = useMemo(() => {
    if (historyItems.length > 0) {
      return Math.max(...historyItems.map((i) => i.totalTokens), 1);
    }
    if (summary?.daily?.length) {
      return Math.max(...summary.daily.map((i) => i.totalTokens), 1);
    }
    return 1;
  }, [historyItems, summary]);

  const models = summary?.models ?? [];

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
      <div className="token-usage-kpis">
        {timeframeList.map((tf) => (
          <div key={tf.id} className="token-usage-kpi">
            <div className="text-xs font-medium uppercase tracking-wide text-text-muted">
              {t(tf.labelKey)}
            </div>
            <div className="mt-1 text-lg font-semibold text-text-primary">
              {tf.totalTokens.toLocaleString()} <span className="text-xs font-normal text-text-muted">tokens</span>
            </div>
            <div className="mt-1 text-sm font-medium text-ds-accent">
              ${tf.costUsd.toFixed(4)} <span className="text-xs text-text-muted">USD</span>
            </div>
          </div>
        ))}
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
        ) : loading && !dailyCells ? (
          <div className="py-10 text-center text-xs text-text-muted">{t("settings.usageRefresh")}</div>
        ) : !dailyCells || dailyCells.every((item) => !item || item.totalTokens === 0) ? (
          <div className="py-10 text-center text-xs text-text-muted">{t("settings.usageEmpty")}</div>
        ) : (
          <div className="token-usage-heatmap-layout">
            <div className="token-usage-weekdays" aria-hidden="true">
              <span>{t("settings.usageMon")}</span>
              <span />
              <span>{t("settings.usageWed")}</span>
              <span />
              <span>{t("settings.usageFri")}</span>
              <span />
              <span />
            </div>
            <div className="token-usage-heatmap" role="grid">
              {dailyCells.map((item, index) =>
                item ? (
                  <button
                    key={item.date}
                    type="button"
                    className={`token-usage-cell${selectedCell?.date === item.date ? " selected" : ""}`}
                    style={{ backgroundColor: cellFill(item.totalTokens, maxTokens) }}
                    aria-label={t("settings.usageCell", {
                      date: item.date,
                      total: item.totalTokens.toLocaleString(),
                    })}
                    aria-pressed={selectedCell?.date === item.date}
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
                  />
                ) : (
                  <span key={`pad-${index}`} className="token-usage-cell token-usage-cell-empty" />
                )
              )}
            </div>
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
                <tr key={tf.id}>
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
