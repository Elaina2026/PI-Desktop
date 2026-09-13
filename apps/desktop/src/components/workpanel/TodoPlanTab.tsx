import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PlanProposal, TodoItem } from "@pi-desktop/shared";
import { api } from "../../lib/api";
import { useAppStore } from "../../stores/app-store";
import { Button, Input } from "../ui";
import {
  IconCheck,
  IconCircleCheck,
  IconClose,
  IconListChecks,
  IconSparkles,
  IconReview,
} from "../icons";
import { Markdown } from "../Markdown";

const QUADRANTS = [
  { id: 1, label: "Q1", title: "Urgent & Important", color: "text-rose-500 bg-rose-500/10 border-rose-500/20" },
  { id: 2, label: "Q2", title: "Important", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  { id: 3, label: "Q3", title: "Urgent", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  { id: 4, label: "Q4", title: "Normal", color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" },
];

export function TodoPlanTab() {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState<"todo" | "plan">("todo");

  // Todo state
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todoFilter, setTodoFilter] = useState<"all" | "active" | "done">("all");
  const [newTodoText, setNewTodoText] = useState("");
  const [newTodoQ, setNewTodoQ] = useState(2);
  const [loadingTodos, setLoadingTodos] = useState(false);

  // Plan state
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const pendingPlans = useAppStore((s) => s.pendingPlans);
  const planProposal: PlanProposal | undefined = activeSessionId
    ? pendingPlans[activeSessionId]
    : undefined;

  const loadTodos = async () => {
    setLoadingTodos(true);
    try {
      const res = await api.listTodos();
      if (res.ok && Array.isArray(res.todos)) {
        setTodos(res.todos);
      }
    } catch {}
    setLoadingTodos(false);
  };

  useEffect(() => {
    void loadTodos();
    return api.onSessionsChanged(() => {
      void loadTodos();
    });
  }, []);

  const handleAddTodo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = newTodoText.trim();
    if (!text) return;

    const newTodo: TodoItem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      text,
      done: false,
      q: newTodoQ,
      createdAt: Date.now(),
      doneAt: 0,
      due: null,
      reminded: false,
    };

    const next = [newTodo, ...todos];
    setTodos(next);
    setNewTodoText("");
    await api.saveTodos(next).catch(() => undefined);
  };

  const handleToggleTodo = async (id: string) => {
    const next = todos.map((item) =>
      item.id === id
        ? { ...item, done: !item.done, doneAt: !item.done ? Date.now() : 0 }
        : item
    );
    setTodos(next);
    await api.saveTodos(next).catch(() => undefined);
  };

  const handleDeleteTodo = async (id: string) => {
    const next = todos.filter((item) => item.id !== id);
    setTodos(next);
    await api.saveTodos(next).catch(() => undefined);
  };

  const handleClearDone = async () => {
    const next = todos.filter((item) => !item.done);
    setTodos(next);
    await api.saveTodos(next).catch(() => undefined);
  };

  // Filtered todos
  const filteredTodos = useMemo(() => {
    if (todoFilter === "active") return todos.filter((t) => !t.done);
    if (todoFilter === "done") return todos.filter((t) => t.done);
    return todos;
  }, [todos, todoFilter]);

  const completedCount = todos.filter((t) => t.done).length;
  const activeCount = todos.length - completedCount;
  const completionPercent = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;

  // Plan approval handler
  const handleResolvePlan = async (action: "ask" | "accept-edits" | "auto" | "reject") => {
    if (!planProposal || !activeSessionId) return;
    if (action === "reject") {
      await api.resolvePlan({
        sessionId: activeSessionId,
        decision: "reject",
      });
    } else {
      await api.resolvePlan({
        sessionId: activeSessionId,
        decision: "approve",
        action,
      });
    }
  };

  return (
    <div className="todo-plan-tab-wrapper">
      {/* Top Switcher Navigation */}
      <div className="todo-plan-header">
        <div className="todo-plan-switcher" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === "todo"}
            className={`todo-plan-switch-btn ${activeSubTab === "todo" ? "active" : ""}`}
            onClick={() => setActiveSubTab("todo")}
          >
            <IconListChecks size={14} />
            <span>Todo List</span>
            {activeCount > 0 && (
              <span className="todo-plan-badge">{activeCount}</span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === "plan"}
            className={`todo-plan-switch-btn ${activeSubTab === "plan" ? "active" : ""}`}
            onClick={() => setActiveSubTab("plan")}
          >
            <IconSparkles size={14} />
            <span>Plan</span>
            {planProposal && (
              <span
                className={`todo-plan-badge ${
                  planProposal.status === "pending"
                    ? "bg-amber-500/20 text-amber-500"
                    : "bg-emerald-500/20 text-emerald-500"
                }`}
              >
                {planProposal.status}
              </span>
            )}
          </button>
        </div>

        {activeSubTab === "todo" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void loadTodos()}
            disabled={loadingTodos}
            aria-label="Refresh todos"
          >
            <IconReview className={loadingTodos ? "animate-spin" : ""} size={13} />
          </Button>
        )}
      </div>

      {/* SUB-TAB 1: TODO LIST */}
      {activeSubTab === "todo" && (
        <div className="todo-panel-body">
          {/* Progress Header */}
          <div className="todo-progress-card">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-text-primary">
                {completedCount} of {todos.length} completed
              </span>
              <span className="font-mono text-ds-accent">{completionPercent}%</span>
            </div>
            <div className="todo-progress-bar-track">
              <div
                className="todo-progress-bar-fill"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>

          {/* Quick Add Form */}
          <form className="todo-add-form" onSubmit={handleAddTodo}>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                className="todo-input flex-1 text-xs"
                placeholder="Add new task (Enter to save)..."
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
              />
              <select
                className="todo-q-select text-xs px-2 py-1.5 rounded bg-ds-tile border border-ds-border-subtle"
                value={newTodoQ}
                onChange={(e) => setNewTodoQ(Number(e.target.value))}
                title="Priority quadrant"
              >
                {QUADRANTS.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.label}: {q.title}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="secondary" type="submit" disabled={!newTodoText.trim()}>
                Add
              </Button>
            </div>
          </form>

          {/* Filter Pills & Actions */}
          <div className="todo-filter-bar">
            <div className="todo-filter-pills">
              {(["all", "active", "done"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`todo-filter-pill ${todoFilter === filter ? "active" : ""}`}
                  onClick={() => setTodoFilter(filter)}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>

            {completedCount > 0 && (
              <button
                type="button"
                className="text-xs text-text-muted hover:text-rose-500 transition-colors"
                onClick={handleClearDone}
              >
                Clear completed
              </button>
            )}
          </div>

          {/* Task List */}
          <div className="todo-list">
            {filteredTodos.length === 0 ? (
              <div className="py-12 text-center text-xs text-text-muted">
                {todoFilter === "done" ? "No completed tasks yet" : "No tasks found"}
              </div>
            ) : (
              filteredTodos.map((item) => {
                const qMeta = QUADRANTS.find((q) => q.id === item.q) || QUADRANTS[1];
                return (
                  <div
                    key={item.id}
                    className={`todo-item-row ${item.done ? "done" : ""}`}
                  >
                    <button
                      type="button"
                      className={`todo-check-btn ${item.done ? "checked" : ""}`}
                      onClick={() => handleToggleTodo(item.id)}
                      aria-label="Toggle completed"
                    >
                      {item.done && <IconCheck size={11} />}
                    </button>

                    <div className="todo-item-text flex-1" onClick={() => handleToggleTodo(item.id)}>
                      <span className={`todo-text ${item.done ? "line-through text-text-muted" : "text-text-primary"}`}>
                        {item.text}
                      </span>
                    </div>

                    <span
                      className={`todo-q-badge px-1.5 py-0.5 rounded text-3xs font-mono font-medium border ${qMeta.color}`}
                      title={qMeta.title}
                    >
                      {qMeta.label}
                    </span>

                    <button
                      type="button"
                      className="todo-delete-btn text-text-muted hover:text-rose-500 p-1"
                      onClick={() => handleDeleteTodo(item.id)}
                      title="Delete task"
                      aria-label="Delete task"
                    >
                      <IconClose size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: PLAN & EXECUTION */}
      {activeSubTab === "plan" && (
        <div className="plan-panel-body">
          {planProposal ? (
            <div className="plan-content-stack">
              {/* Proposal Header */}
              <div className="plan-proposal-header">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-text-primary">
                    {planProposal.title || "Execution Plan"}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase font-mono ${
                      planProposal.status === "pending"
                        ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                        : planProposal.status === "approved"
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                    }`}
                  >
                    {planProposal.status}
                  </span>
                </div>
                {planProposal.question && (
                  <p className="text-xs text-text-secondary mt-1">{planProposal.question}</p>
                )}
              </div>

              {/* Pending Approval Gate Actions */}
              {planProposal.status === "pending" && (
                <div className="plan-approval-actions-box">
                  <div className="text-xs font-medium text-text-primary mb-2">
                    Review and Approve Plan:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => void handleResolvePlan("auto")}
                    >
                      Approve (Auto)
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleResolvePlan("accept-edits")}
                    >
                      Accept Edits
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleResolvePlan("ask")}
                    >
                      Ask
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-500"
                      onClick={() => void handleResolvePlan("reject")}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              )}

              {/* Formatted Markdown Plan View */}
              <div className="plan-markdown-container">
                <Markdown content={planProposal.markdown || planProposal.plan || ""} />
              </div>
            </div>
          ) : (
            <div className="plan-empty-state">
              <div className="p-8 text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-ds-tile flex items-center justify-center text-text-secondary">
                  <IconSparkles size={24} />
                </div>
                <div className="font-semibold text-sm text-text-primary">No Active Plan in this Session</div>
                <p className="text-xs text-text-muted max-w-[280px]">
                  Use Plan mode to let PI-Desktop decompose goals, write comprehensive technical steps, and ask for review before modifying files.
                </p>
                {activeSessionId && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      void api.setSessionMode?.(activeSessionId, "plan");
                    }}
                  >
                    Switch to Plan Mode
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
