import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { UiMessage } from "@pi-desktop/shared";
import { useAppStore } from "../stores/app-store";
import { IconX } from "./icons";
import { resolveModelRate, computeTokenCost } from "../lib/model-pricing";
import { resolveContextWindow, DEFAULT_CONTEXT_WINDOW } from "../lib/context-usage";

export interface HistogramBar {
  id: string;
  kind: "input" | "cache" | "output";
  tokens: number;
  label: string;
  height: number;
  width: number;
}

function formatKiloTokens(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return String(val);
}

export const KiloTaskHeader = memo(function KiloTaskHeader({
  sessionId,
  messages,
}: {
  sessionId?: string;
  messages: UiMessage[];
}) {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const activeSession = useAppStore((state) =>
    sessionId
      ? state.sessions.find((s) => s.id === sessionId)
      : state.sessions.find((s) => s.id === state.activeSessionId),
  );
  const draftConfiguration = useAppStore((state) => state.draftConfiguration);
  const settings = useAppStore((state) => state.settings);
  const providerModels = useAppStore((state) => state.providerModels);
  const providers = useAppStore((state) => state.providers);
  const isRunning = useAppStore((state) => state.isRunning);

  const modelId =
    draftConfiguration?.modelId ||
    activeSession?.modelId ||
    settings?.defaultModelId ||
    "gemini-3.8-flash";

  const providerId = draftConfiguration?.providerId || activeSession?.providerId;

  // Context window ceiling
  const contextLimit = useMemo(() => {
    try {
      const resolved = resolveContextWindow(
        providerId,
        modelId,
        providerModels,
        providers,
      );
      return resolved > 0 ? resolved : DEFAULT_CONTEXT_WINDOW;
    } catch {
      return 256_000;
    }
  }, [providerId, modelId, providerModels, providers]);

  // First user message for the "Task: <prompt>" header
  const firstUserPrompt = useMemo(() => {
    const userMsg = messages.find((m) => m.role === "user" && m.content?.trim());
    if (userMsg?.content) return userMsg.content.trim();
    if (activeSession?.title && activeSession.title !== "New Chat" && activeSession.title !== "New Task") {
      return activeSession.title;
    }
    return t("chat.untitledTask");
  }, [messages, activeSession?.title, t]);

  // Calculate cumulative stats and turn bars
  const { stats, histogramBars } = useMemo(() => {
    let input = 0;
    let output = 0;
    let cache = 0;
    let reasoning = 0;

    const rawBars: Array<{
      id: string;
      kind: "input" | "cache" | "output";
      tokens: number;
      label: string;
    }> = [];

    let turnCounter = 0;

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.parentToolCallId) continue;

      if (m.role === "user") {
        turnCounter += 1;
        const promptLen = (m.content || "").length;
        const estInp = m.usage?.inputTokens || Math.max(120, Math.round(promptLen * 1.3));
        input += m.usage?.inputTokens || estInp;

        rawBars.push({
          id: `inp-${m.id || i}`,
          kind: "input",
          tokens: estInp,
          label: `Turn ${turnCounter} (Input): ${estInp.toLocaleString()} tokens`,
        });
      } else if (m.role === "assistant") {
        if (m.usage) {
          if (m.usage.cacheReadTokens && m.usage.cacheReadTokens > 0) {
            cache += m.usage.cacheReadTokens;
            rawBars.push({
              id: `cache-${m.id || i}`,
              kind: "cache",
              tokens: m.usage.cacheReadTokens,
              label: `Turn ${turnCounter} (Cache): ${m.usage.cacheReadTokens.toLocaleString()} tokens`,
            });
          }
          if (m.usage.outputTokens && m.usage.outputTokens > 0) {
            output += m.usage.outputTokens;
            reasoning += m.usage.reasoningTokens || 0;
            rawBars.push({
              id: `out-${m.id || i}`,
              kind: "output",
              tokens: m.usage.outputTokens,
              label: `Turn ${turnCounter} (Output): ${m.usage.outputTokens.toLocaleString()} tokens`,
            });
          }
        } else {
          const contentLen = (m.content || "").length;
          const estOut = m.responseOutputTokens || Math.max(180, Math.round(contentLen * 1.4));
          output += estOut;
          rawBars.push({
            id: `out-${m.id || i}`,
            kind: "output",
            tokens: estOut,
            label: `Turn ${turnCounter} (Output): ${estOut.toLocaleString()} tokens`,
          });
        }
      }
    }

    const total = input + output + cache;
    const rates = resolveModelRate(modelId);
    const cost = computeTokenCost(
      { inputTokens: input, outputTokens: output, cacheReadTokens: cache },
      rates,
    );

    // Dynamic height scaling for bars
    const maxTokenVal = Math.max(
      ...rawBars.map((b) => b.tokens),
      500,
    );

    const bars: HistogramBar[] = rawBars.map((b) => {
      // Scale height between 6px and 22px
      const h = Math.max(6, Math.min(22, Math.round((b.tokens / maxTokenVal) * 22)));
      // Cache bars are thinner, user/output bars wider
      const w = b.kind === "cache" ? 8 : b.kind === "output" ? 18 : 13;
      return {
        ...b,
        height: h,
        width: w,
      };
    });

    return {
      stats: { input, output, cache, reasoning, total, cost },
      histogramBars: bars,
    };
  }, [messages, modelId]);

  // If no messages or total is 0, do not render task header
  if (messages.length === 0 || stats.total === 0) {
    return null;
  }

  // Progress percentages relative to context limit
  const primaryPct = Math.min(
    100,
    Math.max(1, ((stats.input + stats.output) / contextLimit) * 100),
  );
  const cachePct = Math.min(
    100 - primaryPct,
    (stats.cache / contextLimit) * 100,
  );

  const handleCompact = () => {
    if (isRunning) return;
    void useAppStore.getState().compactContext();
  };

  const handleCloseTask = () => {
    void useAppStore.getState().newSession();
  };

  return (
    <div className="kilo-session-task-header" role="region" aria-label="Task Session Header">
      {/* Row 1: Task Title and Action */}
      <div className="kilo-task-row-top">
        <div className="kilo-task-left">
          <button
            type="button"
            className={`kilo-task-chevron ${isCollapsed ? "is-collapsed" : ""}`}
            onClick={() => setIsCollapsed((v) => !v)}
            aria-label={isCollapsed ? "Expand Token Timeline" : "Collapse Token Timeline"}
            title={isCollapsed ? "Expand Token Timeline" : "Collapse Token Timeline"}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 3.5l5 4.5-5 4.5z" />
            </svg>
          </button>

          <span className="kilo-task-label">Task:</span>
          <span className="kilo-task-prompt" title={firstUserPrompt}>
            {firstUserPrompt}
          </span>
        </div>

        <button
          type="button"
          className="kilo-task-close"
          onClick={handleCloseTask}
          aria-label={t("chat.closeTask") || "Close Task"}
          title={t("chat.closeTask") || "Close Task"}
        >
          <IconX size={12} />
        </button>
      </div>

      {/* Row 2: Turn Histogram Bar Chart */}
      {!isCollapsed && (
        <div className="kilo-task-row-histogram">
          <div className="kilo-histogram-bars">
            {histogramBars.map((bar, idx) => (
              <div
                key={bar.id}
                className={`kilo-bar kilo-bar-${bar.kind}`}
                style={{
                  height: `${bar.height}px`,
                  width: `${bar.width}px`,
                }}
                title={bar.label}
              />
            ))}
          </div>
          <div className="kilo-histogram-divider" aria-hidden />
        </div>
      )}

      {/* Row 3: Context Progress Bar & Limit */}
      <div className="kilo-task-row-progress">
        <span className="kilo-token-val kilo-token-val-current">
          {formatKiloTokens(stats.total)}
        </span>

        <div className="kilo-progress-track">
          {primaryPct > 0 && (
            <div
              className="kilo-progress-fill kilo-progress-fill-primary"
              style={{ width: `${primaryPct}%` }}
              title={`Input + Output: ${formatKiloTokens(stats.input + stats.output)}`}
            />
          )}
          {cachePct > 0 && (
            <div
              className="kilo-progress-fill kilo-progress-fill-cache"
              style={{ width: `${cachePct}%` }}
              title={`Cache: ${formatKiloTokens(stats.cache)}`}
            />
          )}
        </div>

        <span className="kilo-token-val kilo-token-val-limit">
          {formatKiloTokens(contextLimit)}
        </span>

        <button
          type="button"
          className="kilo-compact-btn"
          onClick={handleCompact}
          disabled={isRunning}
          title="Compact Context (/compact)"
          aria-label="Compact Context"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 2v3H2M11 2v3h3M5 14v-3H2M11 14v-3h3" />
          </svg>
        </button>
      </div>
    </div>
  );
});
