import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/app-store";
import {
  IconSidebar,
  IconNewSession,
  IconSearch,
} from "./icons";
import { TooltipButton } from "./ui";

function projectName(path?: string | null, name?: string | null) {
  if (name) return name;
  if (!path) return null;
  const parts = path.split(/[/\\]/).filter(Boolean);
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


function formatKTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function SessionTokenBar({ messages }: { messages: any[] }) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const stats = useMemo(() => {
    let input = 0;
    let output = 0;
    let cache = 0;
    let reasoning = 0;

    for (const m of messages) {
      if (m.usage) {
        input += m.usage.inputTokens || 0;
        output += m.usage.outputTokens || 0;
        cache += m.usage.cacheReadTokens || 0;
        reasoning += m.usage.reasoningTokens || 0;
      }
    }

    const total = input + output + cache;
    return { input, output, cache, reasoning, total };
  }, [messages]);

  if (stats.total === 0) return null;

  const inputPct = Math.round((stats.input / stats.total) * 100) || 0;
  const cachePct = Math.round((stats.cache / stats.total) * 100) || 0;
  const outputPct = Math.round((stats.output / stats.total) * 100) || 0;

  return (
    <div
      className="session-token-insights-topbar"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        padding: "3px 8px",
        borderRadius: "6px",
        backgroundColor: "var(--ds-background-subtle, rgba(255, 255, 255, 0.04))",
        border: "1px solid var(--ds-border-subtle, rgba(255, 255, 255, 0.08))",
        fontSize: "11px",
        color: "var(--ds-text-secondary, #aaa)",
        cursor: "pointer",
        userSelect: "none",
        position: "relative",
        height: "26px",
      }}
      onClick={() => setDetailsOpen((v) => !v)}
      title="Session Token Usage (Click for breakdown)"
    >
      {/* Mini Segmented Bar Chart */}
      <div
        style={{
          display: "flex",
          width: "48px",
          height: "8px",
          borderRadius: "4px",
          overflow: "hidden",
          backgroundColor: "rgba(255, 255, 255, 0.1)",
        }}
      >
        <div style={{ width: `${cachePct}%`, backgroundColor: "#38bdf8" }} title={`Cache: ${cachePct}%`} />
        <div style={{ width: `${inputPct}%`, backgroundColor: "#818cf8" }} title={`Input: ${inputPct}%`} />
        <div style={{ width: `${outputPct}%`, backgroundColor: "#34d399" }} title={`Output: ${outputPct}%`} />
      </div>

      {/* Summary Token Count */}
      <span style={{ fontWeight: 600, color: "var(--ds-text-primary, #ddd)" }}>
        {formatKTokens(stats.total)}
      </span>

      {/* Compact Badges */}
      <span style={{ color: "#38bdf8" }}>
        <span style={{ opacity: 0.7 }}>cache:</span> {formatKTokens(stats.cache)}
      </span>
      <span style={{ color: "#818cf8" }}>
        <span style={{ opacity: 0.7 }}>in:</span> {formatKTokens(stats.input)}
      </span>
      <span style={{ color: "#34d399" }}>
        <span style={{ opacity: 0.7 }}>out:</span> {formatKTokens(stats.output)}
      </span>

      {/* Popover Breakdown Dialog */}
      {detailsOpen && (
        <div
          style={{
            position: "absolute",
            top: "32px",
            right: "0",
            zIndex: 1000,
            backgroundColor: "var(--ds-background-elevated, #18181b)",
            border: "1px solid var(--ds-border-normal, rgba(255, 255, 255, 0.15))",
            borderRadius: "8px",
            padding: "12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            width: "220px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontWeight: 600, fontSize: "12px", color: "var(--ds-text-primary, #eee)", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "4px" }}>
            Session Token Insights
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                <span style={{ color: "#38bdf8" }}>Cache Read</span>
                <strong>{stats.cache.toLocaleString()} ({cachePct}%)</strong>
              </div>
              <div style={{ height: "4px", width: "100%", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${cachePct}%`, backgroundColor: "#38bdf8" }} />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                <span style={{ color: "#818cf8" }}>Input Tokens</span>
                <strong>{stats.input.toLocaleString()} ({inputPct}%)</strong>
              </div>
              <div style={{ height: "4px", width: "100%", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${inputPct}%`, backgroundColor: "#818cf8" }} />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                <span style={{ color: "#34d399" }}>Output Tokens</span>
                <strong>{stats.output.toLocaleString()} ({outputPct}%)</strong>
              </div>
              <div style={{ height: "4px", width: "100%", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${outputPct}%`, backgroundColor: "#34d399" }} />
              </div>
            </div>

            {stats.reasoning > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "#f59e0b", fontSize: "10.5px" }}>
                <span>Thinking (Reasoning)</span>
                <strong>{stats.reasoning.toLocaleString()}</strong>
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "6px", display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
            <span>Total Spent</span>
            <span style={{ color: "var(--ds-text-primary, #fff)" }}>{stats.total.toLocaleString()} tokens</span>
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

  const activeSession = sessions.find((session) => session.id === activeSessionId);

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
        {/*
          Always mounted: the slot animates from 0 to 28px with the dock, so
          unmounting it would reintroduce the first-frame title jump. While the
          sidebar is open the slot is zero-width and hidden from AT.
        */}
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
        <SessionTokenBar messages={messages} />
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
