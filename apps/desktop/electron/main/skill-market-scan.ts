/**
 * Skill market source aggregation without Electron I/O.
 *
 * Catalog JSON sources and GitHub repo auto-scans share one request function
 * (the public-HTTPS client). One failing source only costs itself.
 */
import {
  isSafeSkillSourceUrl,
  sanitizeSkillCatalogId,
  splitSkillDocument,
  validateSkillCatalogFile,
  type SkillCatalogCategory,
  type SkillCatalogEntry,
  type SkillMarketSource,
  type SourcedSkillEntry,
} from "@pi-desktop/shared";

export type CatalogRequest = (url: string, kind: "json" | "text") => Promise<unknown>;

export type SkillMarketSearchResult = {
  entries: SourcedSkillEntry[];
  failedSources: string[];
};

export type SkillMarketDocument = {
  name?: string;
  description?: string;
  body: string;
  resources?: Array<{ path: string; body: string }>;
};

const CACHE_TTL_MS = 5 * 60_000;
const GITHUB_REPO = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#]|$)/;
const JSDELIVR_GH = /^https:\/\/cdn\.jsdelivr\.net\/gh\/([^/]+)\/([^/]+)@([^/]+)\/(.+)$/;
const SKILL_FILE = /(?:^|\/)SKILL\.md$/;

const SKILL_CATEGORY_KEYWORDS: ReadonlyArray<readonly [SkillCatalogCategory, string[]]> = [
  ["data", ["data", "sql", "database", "postgres", "mongo", "redis", "analytics", "dataset", "spreadsheet", "excel", "xlsx", "csv", "dashboard", "chart", "visualization"]],
  ["workflow", ["workflow", "review", "planning", "brainstorm", "checklist", "process", "sop", "handoff", "standup", "retro", "discernment", "verification", "triage", "audit", "security", "incident"]],
  ["coding", ["code", "test", "debug", "api", "git-", "dev", "engineer", "typescript", "python", "react", "frontend", "backend", "refactor", "deploy", "lint", "mcp", "agent", "artifact", "script", "automation", "cli"]],
  ["writing", ["writing", "write", "writer", "comms", "email", "blog", "content", "copy", "editorial", "story", "blogpost", "article", "newsletter", "social-media", "summar", "art", "design", "creative", "gif", "image", "poster", "diagram", "logo", "typography", "mentor"]],
  ["docs", ["doc", "pdf", "pptx", "docx", "word", "slide", "presentation", "report", "wiki", "manual", "guide", "readme", "changelog", "brand", "canvas", "theme"]],
];

export function guessSkillCategories(path: string): SkillCatalogCategory[] {
  const haystack = path.toLowerCase();
  for (const [category, keywords] of SKILL_CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return [category];
    }
  }
  return ["workflow"];
}

export function createSkillMarketAggregator(request: CatalogRequest) {
  const catalogCache = new Map<string, { at: number; entries: SourcedSkillEntry[] }>();
  const documentCache = new Map<string, { at: number; document: SkillMarketDocument }>();

  async function fetchJson<T>(url: string): Promise<T> {
    return (await request(url, "json")) as T;
  }

  async function fetchText(url: string): Promise<string> {
    return (await request(url, "text")) as string;
  }

  async function loadCatalog(source: SkillMarketSource): Promise<SourcedSkillEntry[]> {
    const hit = catalogCache.get(source.url);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.entries;
    const body = await fetchJson<unknown>(source.url);
    const { catalog } = validateSkillCatalogFile(body);
    const entries = catalog.skills.map((entry) => ({
      ...entry,
      id: sanitizeSkillCatalogId(entry.id, `skill-${source.id}`),
      sourceId: source.id,
    }));
    catalogCache.set(source.url, { at: Date.now(), entries });
    return entries;
  }

  async function loadGithubRepo(source: SkillMarketSource): Promise<SourcedSkillEntry[]> {
    const hit = catalogCache.get(source.url);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.entries;
    const match = GITHUB_REPO.exec(source.url.split("?")[0]);
    if (!match) throw new Error(`not a GitHub repo url: ${source.url}`);
    const [, owner, repo] = match;
    const repoInfo = await fetchJson<{ default_branch?: string }>(
      `https://api.github.com/repos/${owner}/${repo}`,
    );
    const branch = repoInfo.default_branch || "main";
    const tree = await fetchJson<{ tree?: Array<{ path: string }> }>(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    );
    const entries: SourcedSkillEntry[] = [];
    const seen = new Set<string>();
    for (const path of (tree.tree ?? []).map((item) => item.path)) {
      if (!path.endsWith("SKILL.md") || path.startsWith("template/")) continue;
      const dir = path.replace(/\/SKILL\.md$/, "");
      const rawSlug = dir.split("/").pop() || `skill-${entries.length}`;
      const id = sanitizeSkillCatalogId(rawSlug, `skill-${entries.length}`);
      if (seen.has(id)) continue;
      seen.add(id);
      entries.push({
        id,
        name: rawSlug,
        author: owner,
        homepage: `https://github.com/${owner}/${repo}/tree/${branch}/${dir}`,
        url: `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${path}`,
        categories: guessSkillCategories(`${dir} ${rawSlug}`),
        sourceId: source.id,
      });
    }
    catalogCache.set(source.url, { at: Date.now(), entries });
    return entries;
  }

  function loadSource(source: SkillMarketSource): Promise<SourcedSkillEntry[]> {
    return GITHUB_REPO.test(source.url.split("?")[0]) ? loadGithubRepo(source) : loadCatalog(source);
  }

  async function fetchDocument(url: string): Promise<SkillMarketDocument> {
    const hit = documentCache.get(url);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.document;
    const document = splitSkillDocument(await fetchText(url)) as SkillMarketDocument;
    const match = JSDELIVR_GH.exec(url);
    if (match) {
      const [, owner, repo, ref, path] = match;
      const dir = path.replace(/SKILL\.md$/, "");
      try {
        const listing = (await fetchJson<{ files?: Array<{ name: string }> }>(
          `https://data.jsdelivr.com/v1/packages/gh/${owner}/${repo}@${ref}?structure=flat`,
        )) as { files?: Array<{ name: string }> };
        const siblings = (listing.files ?? [])
          .map((file) => file.name)
          .filter((name) => name.startsWith(dir) && !SKILL_FILE.test(name) && name.endsWith(".md"));
        const resources: Array<{ path: string; body: string }> = [];
        for (const name of siblings.slice(0, 20)) {
          resources.push({
            path: name.slice(dir.length),
            body: await fetchText(`https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}/${name}`),
          });
        }
        if (resources.length) document.resources = resources;
      } catch {
        // A listing failure degrades to the single document, never blocks.
      }
    }
    documentCache.set(url, { at: Date.now(), document });
    return document;
  }

  async function search(query: string, sources: SkillMarketSource[]): Promise<SkillMarketSearchResult> {
    const trimmed = query.trim().toLocaleLowerCase();
    const usable = sources.filter((source) => isSafeSkillSourceUrl(source.url));
    const failedSources = sources
      .filter((source) => !isSafeSkillSourceUrl(source.url))
      .map((source) => source.name);
    const settled = await Promise.allSettled(
      usable.map(async (source) => {
        const entries = await loadSource(source);
        if (!trimmed) return entries;
        return entries.filter((entry) =>
          [entry.name, entry.description, entry.author]
            .filter(Boolean)
            .some((text) => text!.toLocaleLowerCase().includes(trimmed)),
        );
      }),
    );
    const entries: SourcedSkillEntry[] = [];
    const seen = new Set<string>();
    settled.forEach((result, index) => {
      if (result.status === "rejected") {
        failedSources.push(usable[index].name);
        return;
      }
      for (const entry of result.value) {
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
        entries.push(entry);
      }
    });
    return { entries, failedSources };
  }

  async function fetchEntryDocument(entry: SkillCatalogEntry): Promise<SkillMarketDocument> {
    if (!isSafeSkillSourceUrl(entry.url)) throw new Error("document url must be a public https address");
    return fetchDocument(entry.url);
  }

  return { search, fetchEntryDocument };
}
