import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/app-store";
import {
  IconSidebar,
  IconNewSession,
  IconSearch,
  IconSparkles,
  IconListChecks,
} from "./icons";
import { TooltipButton } from "./ui";
import { todoPlanWorkPanelTab } from "../lib/work-panel-tabs";
import {
  formatTokenCount,
  resolveModelRate,
  computeTokenCost,
} from "../lib/model-pricing";

function projectName(path?: string | null, name?: string | null) {
  if (name) return name;
  if (!path) return null;
  const parts = path.split(/[/\\\\]/).filter(Boolean);
  return parts[parts.length - 1] || path;
}

function isDefaultSessionTitle(title?: string | null) {
  const trimmed = (title || "").trim().toLowerCase();
  if (!trimmed) return true;
  return ["new task", "new chat", "新建任务", "新对话"].includes(trimmed);
}

const TOPBAR_TITLE_MAX_LENGTH = 10;

function truncateTopbarTitle(title: string) {
  const characters = Array.from(title);
  return characters.length > TOPBAR_TITLE_MAX_LENGTH
    ? `${characters.slice(0, TOPBAR_TITLE_MAX_LENGTH).join("")}…`
    : title;
}

function SessionTokenBar({
  messages,
  modelId,
}: {
  messages: any[];
  modelId?: string;
}) {
  const { t } = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!detailsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDetailsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [detailsOpen]);

  const rates = useMemo(() => resolveModelRate(modelId), [modelId]);

  const stats = useMemo(() => {
    let input = 0;
    let output = 0;
    let cache = 0;
    let reasoning = 0;

    for (const m of messages) {
      // Exclude nested subagent internal tool turns from inflating parent topbar
      if (m.parentToolCallId) continue;
      if (m.usage) {
        input += m.usage.inputTokens || 0;
        output += m.usage.outputTokens || 0;
        cache += m.usage.cacheReadTokens || 0;
        reasoning += m.usage.reasoningTokens || 0;
      } else if (m.responseOutputTokens) {
        // Fallback throughput tokens if stream stopped early
        output += m.responseOutputTokens;
      }
    }

    const total = input + output + cache;
    const cost = computeTokenCost(
      { inputTokens: input, outputTokens: output, cacheReadTokens: cache },
      rates,
    );
    return { input, output, cache, reasoning, total, cost };
  }, [messages, rates]);

  if (stats.total === 0) return null;

  const inputPct = Math.round((stats.input / stats.total) * 100) || 0;
  const cachePct = Math.round((stats.cache / stats.total) * 100) || 0;
  const outputPct = Math.round((stats.output / stats.total) * 100) || 0;

  return (
    <div ref={containerRef} className="session-token-insights-topbar">
      <button
        type="button"
        className={`ct-token-pill ${detailsOpen ? "active" : ""}`}
        onClick={() => setDetailsOpen((v) => !v)}
        title={t("settings.sessionTokensTitle")}
        aria-expanded={detailsOpen}
      >
        <div className="ct-token-pill-dots">
          <span
            className="ct-token-dot ct-token-dot-cache"
            title={`Cache: ${formatTokenCount(stats.cache)}`}
          />
          <span
            className="ct-token-dot ct-token-dot-input"
            title={`In: ${formatTokenCount(stats.input)}`}
          />
          <span
            className="ct-token-dot ct-token-dot-output"
            title={`Out: ${formatTokenCount(stats.output)}`}
          />
        </div>

        <span className="ct-token-pill-count">
          {formatTokenCount(stats.total)}
        </span>

        <span className="ct-token-pill-cost">
          {stats.cost === 0
            ? "Free"
            : stats.cost < 0.0001
              ? "<$0.001"
              : `$${stats.cost.toFixed(3)}`}
        </span>
      </button>

      {detailsOpen && (
        <div
          className="ct-token-popover"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="ct-token-popover-header">
            <div className="ct-token-popover-title">
              {t("settings.sessionTokensTitle")}
            </div>
            {modelId && (
              <span className="ct-token-popover-model" title={modelId}>
                {modelId.split("/").pop()}
              </span>
            )}
          </div>

          {/* Kilo Code style Unified Segmented Progress Bar */}
          <div className="ct-token-multi-bar">
            {cachePct > 0 && (
              <div
                className="ct-token-multi-bar-cache"
                style={{ width: `${cachePct}%` }}
                title={`Cache: ${cachePct}%`}
              />
            )}
            {inputPct > 0 && (
              <div
                className="ct-token-multi-bar-input"
                style={{ width: `${inputPct}%` }}
                title={`Input: ${inputPct}%`}
              />
            )}
            {outputPct > 0 && (
              <div
                className="ct-token-multi-bar-output"
                style={{ width: `${outputPct}%` }}
                title={`Output: ${outputPct}%`}
              />
            )}
          </div>

          {/* Breakdown Rows */}
          <div className="ct-token-breakdown-list">
            <div className="ct-token-breakdown-row">
              <span className="ct-token-breakdown-label">
                <span className="ct-token-dot ct-token-dot-cache" />
                {t("settings.sessionTokensCache")}
              </span>
              <span className="ct-token-breakdown-val">
                {stats.cache.toLocaleString()}
                <span className="ct-token-breakdown-pct">({cachePct}%)</span>
              </span>
            </div>

            <div className="ct-token-breakdown-row">
              <span className="ct-token-breakdown-label">
                <span className="ct-token-dot ct-token-dot-input" />
                {t("settings.sessionTokensInput")}
              </span>
              <span className="ct-token-breakdown-val">
                {stats.input.toLocaleString()}
                <span className="ct-token-breakdown-pct">({inputPct}%)</span>
              </span>
            </div>

            <div className="ct-token-breakdown-row">
              <span className="ct-token-breakdown-label">
                <span className="ct-token-dot ct-token-dot-output" />
                {t("settings.sessionTokensOutput")}
              </span>
              <span className="ct-token-breakdown-val">
                {stats.output.toLocaleString()}
                <span className="ct-token-breakdown-pct">({outputPct}%)</span>
              </span>
            </div>

            {stats.reasoning > 0 && (
              <div className="ct-token-breakdown-row">
                <span className="ct-token-breakdown-label">
                  <IconSparkles size={11} />
                  {t("settings.sessionTokensReasoning")}
                </span>
                <span className="ct-token-breakdown-val">
                  {stats.reasoning.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Footer with Total and Cost */}
          <div className="ct-token-popover-footer">
            <div className="ct-token-footer-row">
              <span className="ct-token-footer-label">{t("settings.sessionTokensTotal")}</span>
              <span className="ct-token-footer-value">
                {stats.total.toLocaleString()} tokens
              </span>
            </div>
            <div className="ct-token-footer-row">
              <span className="ct-token-footer-label">{t("settings.sessionTokensCost")}</span>
              <span className="ct-token-footer-cost">
                {stats.cost === 0
                  ? "Free (local / zero-rate)"
                  : `$${stats.cost.toFixed(4)} USD`}
              </span>
            </div>

            <button
              type="button"
              className="ct-token-compact-btn"
              onClick={() => {
                void useAppStore.getState().compactContext();
                setDetailsOpen(false);
              }}
              title="Compact Context (/compact)"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 2v3H2M11 2v3h3M5 14v-3H2M11 14v-3h3" />
              </svg>
              Compact Context (/compact)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ConversationTopbar({
  sidebarCollapsed,
  workPanelOpen,
  onToggleSidebar,
  onNewTask,
  onOpenSearch,
}: {
  sidebarCollapsed: boolean;
  workPanelOpen: boolean;
  onToggleSidebar: () => void;
  onNewTask: () => void;
  onOpenSearch: () => void;
}) {
  const { t } = useTranslation();
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const sessions = useAppStore((s) => s.sessions);
  const workspace = useAppStore((s) => s.workspace);
  const messages = useAppStore((s) => s.messages);
  const draftConfiguration = useAppStore((s) => s.draftConfiguration);
  const settings = useAppStore((s) => s.settings);

  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const currentModelId =
    draftConfiguration?.modelId ||
    activeSession?.modelId ||
    settings?.defaultModelId ||
    "gemini-3.8-flash";

  const fullTaskTitle = isDefaultSessionTitle(activeSession?.title)
    ? t("chat.untitledTask")
    : activeSession?.title || t("chat.untitledTask");
  const taskTitle = truncateTopbarTitle(fullTaskTitle);
  const project = projectName(workspace?.path, workspace?.name);

  return (
    <div
      className={`conversation-topbar${sidebarCollapsed ? " ct-collapsed" : ""}${
        workPanelOpen ? " ct-work-panel-open" : ""
      }`}
      role="toolbar"
      aria-label={t("nav.conversation")}
    >
      <div className="ct-left">
        <div className="ct-lead" aria-hidden={!sidebarCollapsed}>
          <TooltipButton
            type="button"
            className="ct-icon-btn"
            tooltip={t("nav.toggleSidebar")}
            ariaLabel={t("nav.toggleSidebar")}
            tabIndex={sidebarCollapsed ? undefined : -1}
            onClick={onToggleSidebar}
          >
            <IconSidebar size={15} />
          </TooltipButton>
        </div>
        <div
          className="ct-title-wrap"
          title={project ? `${project} · ${fullTaskTitle}` : fullTaskTitle}
        >
          <span className="ct-title">{taskTitle}</span>
        </div>
      </div>

      <div className="ct-right">
        <SessionTokenBar messages={messages} modelId={currentModelId} />
        <div className="ct-actions">
          <TooltipButton
            type="button"
            className="ct-icon-btn"
            tooltip="Todo & Plan"
            ariaLabel="Todo & Plan"
            onClick={() => {
              const state = useAppStore.getState();
              state.openWorkPanelTab(todoPlanWorkPanelTab());
            }}
          >
            <IconListChecks size={15} />
          </TooltipButton>
          <TooltipButton
            type="button"
            className="ct-icon-btn"
            tooltip={t("nav.newTask")}
            ariaLabel={t("nav.newTask")}
            onClick={onNewTask}
          >
            <IconNewSession size={15} />
          </TooltipButton>
          <TooltipButton
            type="button"
            className="ct-icon-btn"
            tooltip={t("nav.search")}
            ariaLabel={t("nav.search")}
            onClick={onOpenSearch}
          >
            <IconSearch size={15} />
          </TooltipButton>
        </div>
      </div>
    </div>
  );
}
