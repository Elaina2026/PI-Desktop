import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GlobalPermissionMode, PlanFileInfo, PlanProposal, TodoItem } from "@pi-desktop/shared";
import { api } from "../../lib/api";
import { useAppStore } from "../../stores/app-store";
import { Button, Input } from "../ui";
import {
  IconCheck,
  IconCircleCheck,
  IconClose,
  IconCopy,
  IconFileText,
  IconFolder,
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
  const [todoFilter, setTodoFilter] = useState<"all" | "in_progress" | "active" | "done">("all");
  const [newTodoText, setNewTodoText] = useState("");
  const [newTodoQ, setNewTodoQ] = useState(2);
  const [loadingTodos, setLoadingTodos] = useState(false);

  // Plan state
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const pendingPlans = useAppStore((s) => s.pendingPlans);
  const resolvePlan = useAppStore((s) => s.resolvePlan);
  const configureActiveSession = useAppStore((s) => s.configureActiveSession);
  const sessions = useAppStore((s) => s.sessions);
  const sendPrompt = useAppStore((s) => s.sendPrompt);
  const workspace = useAppStore((s) => s.workspace);
  const showToast = useAppStore((s) => s.showToast);
  const [planAnswer, setPlanAnswer] = useState("");
  const [newPlanPrompt, setNewPlanPrompt] = useState("");
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [savedPlans, setSavedPlans] = useState<PlanFileInfo[]>([]);
  const [selectedPlanPath, setSelectedPlanPath] = useState<string | null>(null);
  const [selectedPlanContent, setSelectedPlanContent] = useState<string | null>(null);
  const [selectedPlanTitle, setSelectedPlanTitle] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [copiedPlan, setCopiedPlan] = useState(false);

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

  const loadPlanContent = async (path: string, fallbackTitle?: string) => {
    try {
      const res = await api.readPlanFile(path);
      if (res.ok) {
        setSelectedPlanContent(res.content);
        setSelectedPlanTitle(res.title || fallbackTitle || "Plan");
      }
    } catch {}
  };

  const loadSavedPlans = async () => {
    try {
      const res = await api.listPlanFiles();
      if (res.ok && Array.isArray(res.plans)) {
        setSavedPlans(res.plans);
        if (res.plans.length > 0) {
          setSelectedPlanPath((prev) => {
            if (prev && res.plans.some((p) => p.path === prev)) return prev;
            const first = res.plans[0];
            void loadPlanContent(first.path, first.title);
            return first.path;
          });
        }
      }
    } catch {}
  };

  useEffect(() => {
    void loadTodos();
    void loadSavedPlans();
    return api.onSessionsChanged(() => {
      void loadTodos();
      void loadSavedPlans();
    });
  }, []);

  const handleSelectPlanPath = (path: string) => {
    setSelectedPlanPath(path);
    const found = savedPlans.find((p) => p.path === path);
    void loadPlanContent(path, found?.title);
    setShowCreateForm(false);
  };

  const handleCopyPlan = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedPlan(true);
    setTimeout(() => setCopiedPlan(false), 2000);
  };

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
    const next = todos.map((item) => {
      if (item.id !== id) return item;
      const isInProgress = !item.done && (item as any).status === "in_progress";
      const isDone = item.done;
      if (!isInProgress && !isDone) {
        return { ...item, done: false, status: "in_progress" as const, doneAt: 0 };
      } else if (isInProgress) {
        return { ...item, done: true, status: "completed" as const, doneAt: Date.now() };
      } else {
        return { ...item, done: false, status: "pending" as const, doneAt: 0 };
      }
    });
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
    if (todoFilter === "in_progress") {
      return todos.filter((t) => !t.done && (t as any).status === "in_progress");
    }
    if (todoFilter === "active") {
      return todos.filter((t) => !t.done && (t as any).status !== "in_progress");
    }
    if (todoFilter === "done") {
      return todos.filter((t) => t.done);
    }
    return todos;
  }, [todos, todoFilter]);

  const inProgressCount = todos.filter((t) => !t.done && (t as any).status === "in_progress").length;
  const completedCount = todos.filter((t) => t.done).length;
  const activeCount = todos.length - completedCount;
  const completionPercent = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;

  // Plan approval handler
  const handleResolvePlan = async (action: GlobalPermissionMode | "reject") => {
    if (!planProposal || !activeSessionId) return;
    const answer = planAnswer.trim();
    const identity = {
      proposalId: planProposal.id,
      sessionId: planProposal.sessionId,
      turnId: planProposal.turnId,
      toolCallId: planProposal.toolCallId,
      version: planProposal.version,
    };
    try {
      if (action === "reject") {
        await resolvePlan({
          ...identity,
          action: "reject",
        });
        if (answer) {
          await sendPrompt(answer, undefined, planProposal.sessionId);
          setPlanAnswer("");
        }
      } else {
        await resolvePlan({
          ...identity,
          action: "approve",
          targetPermissionMode: action,
        });
        if (answer) {
          await sendPrompt(answer, undefined, planProposal.sessionId);
          setPlanAnswer("");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("PLAN_WORKSPACE_REQUIRED")) {
        showToast("Cần mở một thư mục dự án để duyệt và thực thi Plan.", {
          variant: "error",
        });
      } else {
        showToast(msg, { variant: "error" });
      }
    }
  };

  const handleCreatePlan = async (permissionMode: GlobalPermissionMode) => {
    const promptText = newPlanPrompt.trim();
    if (!promptText || !activeSessionId || creatingPlan) return;
    if (!workspace?.path) {
      showToast("Vui lòng mở một thư mục dự án (Open Folder) trước khi tạo Plan.", {
        variant: "warning",
      });
      return;
    }
    setCreatingPlan(true);
    try {
      const active = sessions.find((s) => s.id === activeSessionId);
      if (active) {
        await configureActiveSession({
          mode: "plan",
          providerId: active.providerId,
          modelId: active.modelId,
          thinkingLevel: active.thinkingLevel,
          permissionMode,
        });
      }
      await sendPrompt(promptText, undefined, activeSessionId);
      setNewPlanPrompt("");
      setShowCreateForm(false);
      setTimeout(() => {
        void loadSavedPlans();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("PLAN_WORKSPACE_REQUIRED")) {
        showToast("Cần mở một thư mục dự án để tạo Plan.", {
          variant: "error",
        });
      } else {
        showToast(msg, { variant: "error" });
      }
    } finally {
      setCreatingPlan(false);
    }
  };

  const currentPlan = useMemo(() => {
    if (planProposal) {
      return {
        title: planProposal.title || "Execution Plan",
        markdown: planProposal.markdown || planProposal.plan || "",
        status: planProposal.status,
        question: planProposal.question,
        filePath: planProposal.artifact?.relativePath || ".pi-desktop/plans/",
        isPending: planProposal.status === "pending",
        isProposal: true,
      };
    }
    if (selectedPlanContent && !showCreateForm) {
      const found = savedPlans.find((p) => p.path === selectedPlanPath);
      return {
        title: selectedPlanTitle || found?.title || "Execution Plan",
        markdown: selectedPlanContent,
        status: "saved",
        question: undefined,
        filePath: found?.relativePath || (found?.filename ? `.pi-desktop/plans/${found.filename}` : ".pi-desktop/plans/"),
        isPending: false,
        isProposal: false,
      };
    }
    return null;
  }, [planProposal, selectedPlanContent, showCreateForm, selectedPlanPath, selectedPlanTitle, savedPlans]);

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
          {/* Subagent Task Execution Header Card */}
          <div className="todo-progress-card p-3 rounded-lg bg-ds-tile border border-ds-border-subtle">
            <div className="flex items-start gap-2.5 mb-2.5">
              <div className="subagent-topology-avatar" style={{ flexShrink: 0, width: 30, height: 30 }}>
                <IconListChecks size={16} className="text-ds-accent" />
                <span
                  className="subagent-topology-status-icon"
                  style={{
                    background:
                      completionPercent === 100 && todos.length > 0
                        ? "var(--ds-success)"
                        : activeCount > 0
                        ? "var(--ds-accent)"
                        : "var(--ds-text-muted)",
                  }}
                >
                  {completionPercent === 100 && todos.length > 0 ? (
                    <IconCheck size={8} />
                  ) : activeCount > 0 ? (
                    <span />
                  ) : (
                    <IconCheck size={8} />
                  )}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-primary">
                    Task Execution Plan
                  </span>
                  <span className="font-mono text-xs font-bold text-ds-accent">
                    {completedCount}/{todos.length} ({completionPercent}%)
                  </span>
                </div>
                <div className="text-3xs text-text-muted mt-0.5 font-mono">
                  {activeCount > 0 ? `${activeCount} steps remaining` : "All tasks completed"}
                </div>
              </div>
            </div>

            <div className="todo-progress-bar-track" style={{ height: 4 }}>
              <div
                className="todo-progress-bar-fill"
                style={{
                  width: `${completionPercent}%`,
                  background:
                    completionPercent === 100
                      ? "var(--ds-success)"
                      : "var(--ds-accent)",
                }}
              />
            </div>
          </div>

          {/* Quick Add Form */}
          <form className="todo-add-form" onSubmit={handleAddTodo}>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                className="todo-input flex-1 text-xs"
                placeholder="Add task step (Enter to save)..."
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
              {(["all", "in_progress", "active", "done"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`todo-filter-pill ${todoFilter === filter ? "active" : ""}`}
                  onClick={() => setTodoFilter(filter)}
                >
                  {filter === "in_progress"
                    ? `In Progress${inProgressCount > 0 ? ` (${inProgressCount})` : ""}`
                    : filter === "all"
                    ? `All (${todos.length})`
                    : filter === "active"
                    ? `Pending (${todos.length - completedCount - inProgressCount})`
                    : `Done (${completedCount})`}
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
                {todoFilter === "done" ? "No completed tasks yet" : todoFilter === "in_progress" ? "No tasks currently in progress" : "No tasks found"}
              </div>
            ) : (
              filteredTodos.map((item, idx) => {
                const qMeta = QUADRANTS.find((q) => q.id === item.q) || QUADRANTS[1];
                const isInProgress = !item.done && (item as any).status === "in_progress";
                return (
                  <div
                    key={item.id}
                    className={`todo-item-row ${item.done ? "done" : isInProgress ? "in-progress" : ""}`}
                    style={{
                      borderLeft: item.done
                        ? "2px solid var(--ds-success)"
                        : isInProgress
                        ? "2px solid var(--ds-accent)"
                        : "2px solid var(--ds-border-subtle, rgba(255,255,255,0.1))",
                    }}
                  >
                    <span className="font-mono text-3xs text-text-muted" style={{ width: 18 }}>
                      {String(idx + 1).padStart(2, "0")}
                    </span>

                    <button
                      type="button"
                      className={`todo-check-btn ${item.done ? "checked" : isInProgress ? "in-progress" : ""}`}
                      onClick={() => handleToggleTodo(item.id)}
                      aria-label={item.done ? "Completed" : isInProgress ? "In Progress" : "Pending"}
                      style={{
                        color: isInProgress ? "var(--ds-accent)" : undefined,
                        borderColor: isInProgress ? "var(--ds-accent)" : undefined,
                        background: isInProgress ? "color-mix(in oklab, var(--ds-accent) 22%, transparent)" : undefined,
                        fontWeight: isInProgress ? 700 : undefined,
                        fontSize: isInProgress ? "14px" : undefined,
                        lineHeight: isInProgress ? 1 : undefined,
                      }}
                    >
                      {item.done ? <IconCheck size={11} /> : isInProgress ? "*" : null}
                    </button>

                    <div className="todo-item-text flex-1" onClick={() => handleToggleTodo(item.id)}>
                      <span
                        className={`todo-text ${
                          item.done
                            ? "line-through text-text-muted"
                            : isInProgress
                            ? "text-white font-medium"
                            : "text-text-primary"
                        }`}
                        style={{
                          color: isInProgress ? "#ffffff" : undefined,
                        }}
                      >
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
          {currentPlan ? (
            <div className="plan-content-stack">
              {/* Plan Toolbar / File Bar */}
              <div className="plan-file-bar">
                <div className="flex items-center gap-2 min-w-0">
                  <IconFileText size={13} className="text-ds-accent flex-shrink-0" />
                  {savedPlans.length > 0 ? (
                    <select
                      className="plan-selector-select"
                      value={selectedPlanPath || ""}
                      onChange={(e) => handleSelectPlanPath(e.target.value)}
                      title="Chọn plan từ .pi-desktop/plans/"
                    >
                      {savedPlans.map((p) => (
                        <option key={p.path} value={p.path}>
                          {p.title || p.filename}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-mono text-3xs truncate">{currentPlan.filePath}</span>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-text-muted hover:text-text-primary px-2"
                    onClick={() => handleCopyPlan(currentPlan.markdown)}
                    title="Copy Markdown plan"
                  >
                    <IconCopy size={12} className="mr-1 inline" />
                    {copiedPlan ? "Đã copy" : "Copy"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="px-2"
                    onClick={() => setShowCreateForm(true)}
                    title="Tạo plan mới"
                  >
                    + Tạo Plan
                  </Button>
                </div>
              </div>

              {/* Proposal Header */}
              <div className="plan-proposal-header">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm text-text-primary truncate">
                    {currentPlan.title || "Execution Plan"}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-3xs font-medium uppercase font-mono flex-shrink-0 ${
                      currentPlan.status === "pending"
                        ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                        : currentPlan.status === "approved"
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    }`}
                  >
                    {currentPlan.status}
                  </span>
                </div>
                <div className="text-3xs text-text-muted font-mono mt-1 flex items-center gap-1">
                  <IconFolder size={11} className="text-text-muted inline" />
                  <span className="truncate">{currentPlan.filePath}</span>
                </div>
                {currentPlan.question && (
                  <p className="text-xs text-text-secondary mt-1">{currentPlan.question}</p>
                )}
              </div>

              {/* Pending Approval Gate Actions */}
              {currentPlan.isPending && (
                <div className="plan-approval-actions-box">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-text-primary">
                      Review & Approve Plan
                    </span>
                    <span className="text-3xs text-text-muted font-mono">
                      Choose execution mode
                    </span>
                  </div>

                  {/* Khu để ghi đáp án */}
                  <div className="plan-answer-box mb-3">
                    <label className="text-3xs font-mono text-text-muted mb-1 block">
                      Đáp án / Ghi chú cho plan (Answer / Instructions):
                    </label>
                    <textarea
                      className="plan-answer-textarea"
                      placeholder="Ghi đáp án hoặc chỉ dẫn bổ sung trước khi duyệt plan..."
                      value={planAnswer}
                      onChange={(e) => setPlanAnswer(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => void handleResolvePlan("accept-edits")}
                      title="Tự động chấp nhận chỉnh sửa khi thực thi plan"
                    >
                      <IconCheck size={12} className="mr-1 inline" />
                      Auto Accept-Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleResolvePlan("auto")}
                      title="Chạy tự động hoàn toàn, không cần phê duyệt (No Approval)"
                    >
                      <IconSparkles size={12} className="mr-1 inline text-ds-accent" />
                      No Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleResolvePlan("ask")}
                      title="Hỏi trước mỗi bước thay đổi"
                    >
                      Ask
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-500 hover:bg-rose-500/10 ml-auto"
                      onClick={() => void handleResolvePlan("reject")}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              )}

              {/* Formatted Markdown Plan View with full auto-scaling display */}
              <div className="plan-markdown-container prose-chat">
                <Markdown source={currentPlan.markdown} />
              </div>
            </div>
          ) : (
            <div className="plan-empty-state">
              <div className="p-6 flex flex-col gap-4 max-w-md mx-auto">
                <div className="text-center flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-ds-tile flex items-center justify-center text-text-secondary">
                    <IconSparkles size={20} className="text-ds-accent" />
                  </div>
                  <div className="font-semibold text-sm text-text-primary">Tạo Plan Mới (Create Plan)</div>
                  <p className="text-xs text-text-muted">
                    Lập kế hoạch các bước kỹ thuật chi tiết lưu vào .pi-desktop/plans/ trước khi chỉnh sửa file.
                  </p>
                </div>

                {/* Khu để ghi đáp án / yêu cầu tạo plan */}
                <div className="plan-create-input-box">
                  <label className="text-3xs font-mono text-text-muted mb-1 block">
                    Yêu cầu / Đáp án cho Plan:
                  </label>
                  <textarea
                    className="plan-answer-textarea"
                    placeholder="Ghi đáp án hoặc yêu cầu cần lập plan, ví dụ: 'Refactor module auth và bổ sung tests'..."
                    value={newPlanPrompt}
                    onChange={(e) => setNewPlanPrompt(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!newPlanPrompt.trim() || creatingPlan}
                    onClick={() => void handleCreatePlan("accept-edits")}
                    title="Tạo plan với chế độ Auto Accept-Edit"
                  >
                    <IconCheck size={12} className="mr-1 inline" />
                    Auto Accept-Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!newPlanPrompt.trim() || creatingPlan}
                    onClick={() => void handleCreatePlan("auto")}
                    title="Tạo plan với chế độ No Approve (tự động)"
                  >
                    <IconSparkles size={12} className="mr-1 inline text-ds-accent" />
                    No Approve
                  </Button>
                  {savedPlans.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-xs"
                      onClick={() => setShowCreateForm(false)}
                    >
                      ← Xem plan đã lưu
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
