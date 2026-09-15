import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useAppStore } from "../stores/app-store";
import { fuzzyMatchPath, type FsIndexEntry, type FsIndexResult } from "@pi-desktop/shared";
import { IconFileText, IconSearch } from "./icons";

// ponytail: fuzzy filename search; upgrade to ripgrep full-text search when requested.
export type QuickOpenDialogProps = {
  open: boolean;
  onClose: () => void;
};

function highlightMatch(path: string, query: string): ReactNode {
  const q = query.trim().toLowerCase();
  if (!q) return path;
  const index = path.toLowerCase().indexOf(q);
  if (index < 0) return path;
  return (
    <>
      {path.slice(0, index)}
      <mark className="search-hit">{path.slice(index, index + q.length)}</mark>
      {path.slice(index + q.length)}
    </>
  );
}

export function QuickOpenDialog({ open, onClose }: QuickOpenDialogProps) {
  const { t } = useTranslation();
  const workspace = useAppStore((s) => s.workspace);
  const openFileInWorkPanel = useAppStore((s) => s.openFileInWorkPanel);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [indexResult, setIndexResult] = useState<FsIndexResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    if (!workspace?.path) {
      setIndexResult(null);
      return;
    }
    setLoading(true);
    api.fsIndex()
      .then((res) => {
        setIndexResult(res);
      })
      .catch(() => {
        setIndexResult(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, workspace?.path]);

  const fileEntries = useMemo(() => {
    if (!indexResult?.entries) return [];
    return indexResult.entries.filter((e) => e.kind === "file");
  }, [indexResult]);

  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return fileEntries.slice(0, 50);
    const scored: Array<{ entry: FsIndexEntry; score: number }> = [];
    for (const entry of fileEntries) {
      const match = fuzzyMatchPath(q, entry.path, entry.kind);
      if (match) {
        scored.push({ entry, score: match.score });
      }
    }
    scored.sort((a, b) => b.score - a.score || a.entry.path.localeCompare(b.entry.path));
    return scored.slice(0, 50).map((s) => s.entry);
  }, [fileEntries, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  const handleSelect = (entry: FsIndexEntry) => {
    openFileInWorkPanel(entry.path);
    onClose();
  };

  return (
    <div
      className="overlay search-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="dialog search-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("nav.quickOpen", "Go to File")}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <div className="search-input-row">
          <IconSearch size={16} aria-hidden />
          <input
            className="search-input"
            role="combobox"
            aria-expanded="true"
            aria-controls="quick-open-results"
            aria-activedescendant={`quick-open-option-${active}`}
            aria-label={t("nav.quickOpen", "Go to File")}
            placeholder={t("search.quickOpenPlaceholder", "Type a file name to open...")}
            value={query}
            autoFocus
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((prev) => Math.min(prev + 1, Math.max(0, matches.length - 1)));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((prev) => Math.max(prev - 1, 0));
              }
              if (event.key === "Enter") {
                event.preventDefault();
                if (matches[active]) {
                  handleSelect(matches[active]);
                }
              }
            }}
          />
        </div>

        <div
          id="quick-open-results"
          className="search-results"
          role="listbox"
          aria-label={t("nav.quickOpen", "Go to File")}
        >
          {!workspace?.path ? (
            <div className="search-empty">
              {t("workpanel.openFolderPrompt", "Please open a project folder to browse files.")}
            </div>
          ) : loading ? (
            <div className="search-empty">
              {t("common.loading", "Loading files...")}
            </div>
          ) : matches.length === 0 ? (
            <div className="search-empty">
              {t("search.noFilesFound", "No files matching query.")}
            </div>
          ) : (
            matches.map((entry, idx) => {
              const fileName = entry.path.split(/[\\/]/).pop() || entry.path;
              const dirName = entry.path.includes("/") || entry.path.includes("\\")
                ? entry.path.slice(0, Math.max(entry.path.lastIndexOf("/"), entry.path.lastIndexOf("\\")))
                : "";
              return (
                <button
                  key={entry.path}
                  id={`quick-open-option-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={active === idx}
                  className={`search-item ${active === idx ? "active" : ""}`}
                  onClick={() => handleSelect(entry)}
                  onMouseEnter={() => setActive(idx)}
                >
                  <IconFileText size={15} className="text-text-muted shrink-0" aria-hidden />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium text-text-primary truncate">
                      {highlightMatch(fileName, query)}
                    </div>
                    {dirName ? (
                      <div className="text-3xs text-text-muted truncate">
                        {dirName}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
