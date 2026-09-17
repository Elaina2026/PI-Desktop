import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { reviewChangesFromMessages, summarizeReviewChanges } from "../../lib/workspace-review";
import { useAppStore } from "../../stores/app-store";
import type { DiffFile, WorkspaceDiff as GitWorkingTreeDiff } from "@pi-desktop/shared";
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconDiff,
  IconRefresh,
  IconSparkles,
} from "../icons";
import { ReviewChangeCard } from "../ReviewChangeCard";
import { WorkTabEmpty } from "./WorkTabEmpty";
import { Button } from "../ui";

// ponytail: working tree review + one-click AI commit; upgrade to hunk-level staging when required.

type ReviewViewMode = "session" | "workingTree";

const STATUS_LETTERS: Record<string, string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  untracked: "U",
};

export function ReviewTab() {
  const { t } = useTranslation();
  const messages = useAppStore((state) => state.messages);
  const workspace = useAppStore((state) => state.workspace);
  const showToast = useAppStore((state) => state.showToast);

  const sessionEntries = useMemo(() => reviewChangesFromMessages(messages), [messages]);
  const sessionSummary = useMemo(() => summarizeReviewChanges(sessionEntries), [sessionEntries]);

  const [viewMode, setViewMode] = useState<ReviewViewMode>("session");
  const [gitDiff, setGitDiff] = useState<GitWorkingTreeDiff | null>(null);
  const [loadingGit, setLoadingGit] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [commitMessage, setCommitMessage] = useState("");
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [stagingPath, setStagingPath] = useState<string | null>(null);
  const [stagingHunkKey, setStagingHunkKey] = useState<string | null>(null);

  const fetchGitDiff = useCallback(async () => {
    if (!workspace?.path) {
      setGitDiff(null);
      return;
    }
    setLoadingGit(true);
    try {
      const res = await api.gitWorkingTree();
      setGitDiff(res);
    } catch {
      setGitDiff(null);
    } finally {
      setLoadingGit(false);
    }
  }, [workspace?.path]);

  useEffect(() => {
    if (viewMode === "workingTree") {
      void fetchGitDiff();
    }
  }, [viewMode, fetchGitDiff]);

  const toggleExpand = (filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) next.delete(filePath);
      else next.add(filePath);
      return next;
    });
  };

  const handleStage = async (file: DiffFile, event: React.MouseEvent) => {
    event.stopPropagation();
    setStagingPath(file.path);
    try {
      const updated = await api.gitStage([file.path]);
      setGitDiff(updated);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), { variant: "error" });
    } finally {
      setStagingPath(null);
    }
  };

  const handleUnstage = async (file: DiffFile, event: React.MouseEvent) => {
    event.stopPropagation();
    setStagingPath(file.path);
    try {
      const updated = await api.gitUnstage([file.path]);
      setGitDiff(updated);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), { variant: "error" });
    } finally {
      setStagingPath(null);
    }
  };

  const handleStageHunk = async (
    filePath: string,
    hunkHeader: string,
    lines: any[],
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    const key = `${filePath}:${hunkHeader}`;
    setStagingHunkKey(key);
    try {
      const updated = await api.gitStageHunk(filePath, hunkHeader, lines);
      setGitDiff(updated);
      showToast(t("git.stageHunk"), { variant: "success" });
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), { variant: "error" });
    } finally {
      setStagingHunkKey(null);
    }
  };

  const handleDiscardHunk = async (
    filePath: string,
    hunkHeader: string,
    lines: any[],
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    const key = `${filePath}:${hunkHeader}`;
    setStagingHunkKey(key);
    try {
      const updated = await api.gitDiscardHunk(filePath, hunkHeader, lines);
      setGitDiff(updated);
      showToast(t("git.discardHunk"), { variant: "success" });
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), { variant: "error" });
    } finally {
      setStagingHunkKey(null);
    }
  };

  const handleStageAll = async () => {
    if (!gitDiff?.files.length) return;
    setLoadingGit(true);
    try {
      const paths = gitDiff.files.map((f) => f.path);
      const updated = await api.gitStage(paths);
      setGitDiff(updated);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), { variant: "error" });
    } finally {
      setLoadingGit(false);
    }
  };

  const handleGenerateCommitMessage = async () => {
    setGeneratingMessage(true);
    try {
      const res = await api.gitGenerateCommitMessage();
      if (res.message) {
        setCommitMessage(res.message);
        showToast(t("git.messageGenerated", "Commit message generated!"), { variant: "success" });
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), { variant: "error" });
    } finally {
      setGeneratingMessage(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim() || committing) return;
    setCommitting(true);
    try {
      const updated = await api.gitCommit(commitMessage);
      setGitDiff(updated);
      setCommitMessage("");
      showToast(t("git.commitSuccess", "Committed successfully!"), { variant: "success" });
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), { variant: "error" });
    } finally {
      setCommitting(false);
    }
  };

  const gitSummary = useMemo(() => {
    if (!gitDiff?.files) return { files: 0, additions: 0, deletions: 0 };
    let additions = 0;
    let deletions = 0;
    for (const f of gitDiff.files) {
      additions += f.additions;
      deletions += f.deletions;
    }
    return { files: gitDiff.files.length, additions, deletions };
  }, [gitDiff]);

  return (
    <div className="review-tab">
      {/* Top View Selector */}
      <div className="review-toolbar flex items-center justify-between border-b border-border-subtle pb-2 mb-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
              viewMode === "session"
                ? "bg-ds-tile text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
            onClick={() => setViewMode("session")}
          >
            {t("panel.review.sessionMode", "Session")} ({sessionEntries.length})
          </button>
          <button
            type="button"
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
              viewMode === "workingTree"
                ? "bg-ds-tile text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
            onClick={() => setViewMode("workingTree")}
          >
            {t("panel.review.workingTreeMode", "Working Tree")}{" "}
            {gitDiff ? `(${gitDiff.files.length})` : ""}
          </button>
        </div>

        {viewMode === "session" ? (
          <span className="diff-counts text-xs">
            <span className="diff-count-add">+{sessionSummary.additions}</span>
            <span className="diff-count-del">−{sessionSummary.deletions}</span>
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="diff-counts text-xs">
              <span className="diff-count-add">+{gitSummary.additions}</span>
              <span className="diff-count-del">−{gitSummary.deletions}</span>
            </span>
            <button
              type="button"
              className="icon-btn p-1 text-text-muted hover:text-text-primary"
              title={t("common.refresh", "Refresh")}
              disabled={loadingGit}
              onClick={() => void fetchGitDiff()}
            >
              <IconRefresh size={13} className={loadingGit ? "animate-spin" : ""} />
            </button>
          </div>
        )}
      </div>

      {/* Session View */}
      {viewMode === "session" && (
        <div className="review-scroll">
          {sessionEntries.length === 0 ? (
            <WorkTabEmpty
              icon={IconDiff}
              title={t("panel.review.noChanges")}
              body={t("panel.review.noChangesHint")}
            />
          ) : (
            sessionEntries.map((entry) => (
              <ReviewChangeCard
                key={entry.change.snapshotId}
                message={entry.message}
                compact
              />
            ))
          )}
        </div>
      )}

      {/* Working Tree View */}
      {viewMode === "workingTree" && (
        <div className="review-scroll flex flex-col flex-1 min-h-0 gap-3">
          {!workspace?.path ? (
            <WorkTabEmpty
              icon={IconDiff}
              title={t("workpanel.openFolderPrompt", "Please open a project folder")}
              body=""
            />
          ) : !gitDiff?.repo ? (
            <WorkTabEmpty
              icon={IconDiff}
              title={t("git.notRepo", "Not a Git Repository")}
              body={t("git.notRepoHint", "The current workspace folder is not tracked by Git.")}
            />
          ) : gitDiff.clean ? (
            <WorkTabEmpty
              icon={IconCheck}
              title={t("git.cleanTitle", "Working Tree Clean")}
              body={t("git.cleanHint", "No unstaged or untracked changes in the workspace.")}
            />
          ) : (
            <>
              {/* Toolbar Actions */}
              <div className="flex items-center justify-between px-1">
                <span className="text-3xs font-mono text-text-muted">
                  {gitDiff.files.length} {t("git.changedFiles", "file(s) modified")}
                </span>
                <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={handleStageAll}>
                  {t("git.stageAll", "Stage All")}
                </Button>
              </div>

              {/* Changed Files List */}
              <div className="flex flex-col gap-1">
                {gitDiff.files.map((file) => {
                  const isExpanded = expandedFiles.has(file.path);
                  const isStaging = stagingPath === file.path;
                  const letter = STATUS_LETTERS[file.status] ?? "M";
                  return (
                    <div
                      key={file.path}
                      className="border border-border-subtle rounded-md overflow-hidden bg-ds-tile/30"
                    >
                      <div
                        className="flex items-center justify-between p-2 cursor-pointer hover:bg-ds-tile transition-colors select-none"
                        onClick={() => toggleExpand(file.path)}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                          <span
                            className={`text-3xs font-mono font-bold px-1.5 py-0.5 rounded ${
                              file.status === "added" || file.status === "untracked"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : file.status === "deleted"
                                  ? "bg-rose-500/20 text-rose-400"
                                  : "bg-amber-500/20 text-amber-400"
                            }`}
                          >
                            {letter}
                          </span>
                          <span className="text-xs font-mono truncate text-text-primary">{file.path}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="diff-counts text-3xs">
                            <span className="diff-count-add">+{file.additions}</span>
                            <span className="diff-count-del">−{file.deletions}</span>
                          </span>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-6 text-3xs px-2"
                            disabled={isStaging}
                            onClick={(e) => void handleStage(file, e)}
                          >
                            {t("git.stage", "Stage")}
                          </Button>
                        </div>
                      </div>

                      {/* Hunk diff viewer */}
                      {isExpanded && (
                        <div className="border-t border-border-subtle p-2 bg-ds-bg-base/60 text-xs font-mono overflow-x-auto max-h-64">
                          {file.hunks.length === 0 ? (
                            <div className="text-text-muted text-3xs py-1">
                              {file.status === "untracked"
                                ? t("git.untrackedEmpty", "New untracked file")
                                : t("git.noHunks", "Binary or empty changes")}
                            </div>
                          ) : (
                            file.hunks.map((hunk, hIdx) => {
                              const hunkKey = `${file.path}:${hunk.header}`;
                              const isHunkBusy = stagingHunkKey === hunkKey;
                              return (
                                <div className="diff-hunk mb-2" key={hIdx}>
                                  <div className="diff-line hunk text-text-muted bg-ds-tile/40 px-1 py-0.5 rounded text-3xs flex items-center justify-between">
                                    <span>{hunk.header}</span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        className="px-1.5 py-0.5 text-3xs rounded hover:bg-emerald-500/20 text-emerald-400 disabled:opacity-50"
                                        disabled={isHunkBusy}
                                        onClick={(e) =>
                                          void handleStageHunk(
                                            file.path,
                                            hunk.header,
                                            hunk.lines,
                                            e,
                                          )
                                        }
                                        title={t("git.stageHunk")}
                                      >
                                        + {t("git.stageHunk")}
                                      </button>
                                      <button
                                        type="button"
                                        className="px-1.5 py-0.5 text-3xs rounded hover:bg-rose-500/20 text-rose-400 disabled:opacity-50"
                                        disabled={isHunkBusy}
                                        onClick={(e) =>
                                          void handleDiscardHunk(
                                            file.path,
                                            hunk.header,
                                            hunk.lines,
                                            e,
                                          )
                                        }
                                        title={t("git.discardHunk")}
                                      >
                                        ✕ {t("git.discardHunk")}
                                      </button>
                                    </div>
                                  </div>
                                  {hunk.lines.map((line, lIdx) => (
                                    <div
                                      key={lIdx}
                                      className={`diff-line px-1 flex ${
                                        line.type === "add"
                                          ? "bg-emerald-500/10 text-emerald-300"
                                          : line.type === "del"
                                            ? "bg-rose-500/10 text-rose-300"
                                            : "text-text-secondary"
                                      }`}
                                    >
                                      <span className="w-4 select-none shrink-0" aria-hidden>
                                        {line.type === "add" ? "+" : line.type === "del" ? "−" : " "}
                                      </span>
                                      <span className="diff-line-text whitespace-pre">{line.text}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Commit Section */}
              <div className="mt-auto pt-3 border-t border-border-subtle flex flex-col gap-2">
                <label className="text-3xs font-mono text-text-muted">
                  {t("git.commitMessageLabel", "Commit Message:")}
                </label>
                <textarea
                  className="w-full bg-ds-tile/50 border border-border-subtle rounded p-2 text-xs text-text-primary focus:border-ds-accent focus:outline-none resize-none font-mono"
                  rows={3}
                  placeholder={t("git.commitPlaceholder", "type(scope): message subject...")}
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1 text-xs"
                    disabled={generatingMessage}
                    onClick={() => void handleGenerateCommitMessage()}
                  >
                    <IconSparkles size={13} className={`mr-1 inline text-ds-accent ${generatingMessage ? "animate-spin" : ""}`} />
                    {generatingMessage ? t("common.generating", "Generating...") : t("git.generateAiCommit", "AI Commit")}
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    className="flex-1 text-xs"
                    disabled={!commitMessage.trim() || committing}
                    onClick={() => void handleCommit()}
                  >
                    <IconCheck size={13} className="mr-1 inline" />
                    {committing ? t("common.committing", "Committing...") : t("git.commit", "Commit")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
