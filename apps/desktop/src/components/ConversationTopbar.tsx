import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/app-store";
import {
  IconSidebar,
  IconNewSession,
  IconSearch,
  IconSparkles,
} from "./icons";
import { TooltipButton } from "./ui";
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
    <div
      ref={containerRef}
      className="session-token-insights-topbar"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      <button
        type="button"
        className={`ct-token-pill ${detailsOpen ? "active" : ""}`}
        onClick={() => setDetailsOpen((v) => !v)}
        title={t("settings.sessionTokensTitle")}
        aria-expanded={detailsOpen}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "4px 10px",
          borderRadius: "9999px",
          backgroundColor: "var(--ds-tile)",
          border: "1px solid var(--ds-border-subtle)",
          fontSize: "11px",
          color: "var(--ds-text-secondary)",
          cursor: "pointer",
          userSelect: "none",
          height: "26px",
          transition: "border-color 0.15s ease, background-color 0.15s ease",
        }}
      >
        {/* Visual Progress Dot Cluster */}
        <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#38bdf8",
            }}
            title={`Cache: ${formatTokenCount(stats.cache)}`}
          />
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#818cf8",
            }}
            title={`In: ${formatTokenCount(stats.input)}`}
          />
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#34d399",
            }}
            title={`Out: ${formatTokenCount(stats.output)}`}
          />
        </div>

        {/* Total Tokens Formatted */}
        <span style={{ fontWeight: 600, color: "var(--ds-text-primary)" }}>
          {formatTokenCount(stats.total)}
        </span>

        {/* Cost Badge */}
        <span
          style={{
            fontSize: "10.5px",
            fontWeight: 500,
            color: "var(--ds-accent)",
            backgroundColor: "rgba(56, 189, 248, 0.08)",
            padding: "1px 5px",
            borderRadius: "4px",
          }}
        >
          ${stats.cost < 0.0001 && stats.cost > 0 ? "<$0.001" : stats.cost.toFixed(3)}
        </span>
      </button>

      {/* Modern Popover Breakdown Dialog */}
      {detailsOpen && (
        <div
          className="ct-token-popover"
          style={{
            position: "absolute",
            top: "34px",
            right: "0",
            zIndex: 1000,
            backgroundColor: "var(--ds-bg-elevated)",
            border: "1px solid var(--ds-border-strong)",
            borderRadius: "var(--radius-md)",
            padding: "14px",
            boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
            width: "260px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Title & Active Model */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid var(--ds-border-subtle)",
              paddingBottom: "8px",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: "12px", color: "var(--ds-text-primary)" }}>
              {t("settings.sessionTokensTitle")}
            </div>
            {modelId && (
              <span
                style={{
                  fontSize: "10px",
                  fontFamily: "var(--font-mono)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  backgroundColor: "var(--ds-tile)",
                  color: "var(--ds-text-muted)",
                }}
              >
                {modelId.split("/").pop()}
              </span>
            )}
          </div>

          {/* Breakdown Bars */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {/* Cache Read */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "3px" }}>
                <span style={{ color: "#38bdf8", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#38bdf8" }} />
                  {t("settings.sessionTokensCache")}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--ds-text-secondary)" }}>
                  {stats.cache.toLocaleString()} ({cachePct}%)
                </span>
              </div>
              <div style={{ height: "4px", width: "100%", backgroundColor: "var(--ds-tile)", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${cachePct}%`, backgroundColor: "#38bdf8" }} />
              </div>
            </div>

            {/* Input Tokens */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "3px" }}>
                <span style={{ color: "#818cf8", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#818cf8" }} />
                  {t("settings.sessionTokensInput")}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--ds-text-secondary)" }}>
                  {stats.input.toLocaleString()} ({inputPct}%)
                </span>
              </div>
              <div style={{ height: "4px", width: "100%", backgroundColor: "var(--ds-tile)", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${inputPct}%`, backgroundColor: "#818cf8" }} />
              </div>
            </div>

            {/* Output Tokens */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "3px" }}>
                <span style={{ color: "#34d399", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#34d399" }} />
                  {t("settings.sessionTokensOutput")}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--ds-text-secondary)" }}>
                  {stats.output.toLocaleString()} ({outputPct}%)
                </span>
              </div>
              <div style={{ height: "4px", width: "100%", backgroundColor: "var(--ds-tile)", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${outputPct}%`, backgroundColor: "#34d399" }} />
              </div>
            </div>

            {/* Reasoning Tokens if present */}
            {stats.reasoning > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#f59e0b" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <IconSparkles size={11} />
                  {t("settings.sessionTokensReasoning")}
                </span>
                <span style={{ fontFamily: "var(--font-mono)" }}>
                  {stats.reasoning.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Footer with Total and Cost */}
          <div
            style={{
              borderTop: "1px solid var(--ds-border-subtle)",
              paddingTop: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
              <span style={{ color: "var(--ds-text-muted)" }}>{t("settings.sessionTokensTotal")}</span>
              <span style={{ fontWeight: 600, color: "var(--ds-text-primary)" }}>
                {stats.total.toLocaleString()} tokens
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
              <span style={{ color: "var(--ds-text-muted)" }}>{t("settings.sessionTokensCost")}</span>
              <span style={{ fontWeight: 600, color: "var(--ds-accent)" }}>
                ${stats.cost.toFixed(4)} USD
              </span>
            </div>
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
