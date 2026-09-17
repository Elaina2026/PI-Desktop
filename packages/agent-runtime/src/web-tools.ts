/**
 * Web search and fetch tools for the agent runtime.
 * Implemented in pure TypeScript over native fetch.
 */

// ponytail: regex HTML text scraper; upgrade to headless Playwright when JS-rendered SPAs required.

const PRIVATE_IP_REGEX = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|::1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+)$/i;

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

export function validateSafeUrl(rawUrl: string): URL {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${parsed.protocol}. Only http and https are allowed.`);
  }
  const hostname = parsed.hostname.toLowerCase();
  if (PRIVATE_IP_REGEX.test(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error(`Access to local/private network address ${hostname} is blocked.`);
  }
  return parsed;
}

async function fetchWithExa(
  url: string,
  apiKey: string,
  maxChars: number,
): Promise<string | null> {
  try {
    const res = await fetch("https://api.exa.ai/contents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        urls: [url],
        text: { maxCharacters: maxChars },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    if (Array.isArray(data.results) && data.results[0]?.text) {
      return data.results[0].text;
    }
  } catch {}
  return null;
}

export async function executeWebFetch(
  url: string,
  maxChars = 20_000,
): Promise<string> {
  const parsed = validateSafeUrl(url);
  const cappedLimit = Math.min(Math.max(1000, maxChars), 100_000);

  const exaKey = process.env.EXA_API_KEY?.trim();
  if (exaKey) {
    const exaContent = await fetchWithExa(parsed.toString(), exaKey, cappedLimit);
    if (exaContent) {
      return exaContent.length <= cappedLimit
        ? exaContent
        : `${exaContent.slice(0, cappedLimit)}\n\n[... Truncated at ${cappedLimit} characters]`;
    }
  }

  const response = await fetch(parsed.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 PI-Desktop",
      Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} fetching ${url}`);
  }

  const raw = await response.text();
  const text = raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "")
    .replace(/<(?:p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();

  const decoded = decodeHtmlEntities(text);
  if (decoded.length <= cappedLimit) {
    return decoded;
  }
  return `${decoded.slice(0, cappedLimit)}\n\n[... Truncated at ${cappedLimit} characters]`;
}

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

async function searchWithExa(
  query: string,
  apiKey: string,
  limit: number,
): Promise<SearchResult[] | null> {
  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        query,
        numResults: limit,
        useAutoprompt: true,
        contents: { text: { maxCharacters: 1000 } },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    if (Array.isArray(data.results) && data.results.length > 0) {
      return data.results.map((r: any) => ({
        title: decodeHtmlEntities(r.title || r.url),
        url: r.url,
        snippet: decodeHtmlEntities(
          r.text ? r.text.slice(0, 300).replace(/\s+/g, " ") : (r.highlights?.[0] || ""),
        ),
      }));
    }
  } catch {}
  return null;
}

export async function executeWebSearch(
  query: string,
  limit = 5,
): Promise<string> {
  const trimmed = query.trim();
  if (!trimmed) return "Query cannot be empty.";
  const maxResults = Math.min(Math.max(1, limit), 10);

  const exaKey = process.env.EXA_API_KEY?.trim();
  if (exaKey) {
    const exaResults = await searchWithExa(trimmed, exaKey, maxResults);
    if (exaResults && exaResults.length > 0) {
      return exaResults
        .map(
          (result, idx) =>
            `### ${idx + 1}. [${result.title}](${result.url})\n${result.snippet || "No description provided."}`,
        )
        .join("\n\n");
    }
  }

  // Use DuckDuckGo HTML endpoint with standard query
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(trimmed)}`;
  const response = await fetch(searchUrl, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 PI-Desktop",
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html",
    },
    body: `q=${encodeURIComponent(trimmed)}`,
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Search provider returned HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const results: SearchResult[] = [];

  // Match DuckDuckGo result blocks
  const blockRegex = /<div class="result__body">([\s\S]*?)<\/div>/g;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(html)) !== null && results.length < maxResults) {
    const block = match[1] || "";
    const titleMatch = /<a class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block)
      || /<a class="result__snippet"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block)
      || /href="([^"]+)" class="result__url"/i.exec(block);

    const anchorMatch = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    const snippetText = anchorMatch ? anchorMatch[1].replace(/<[^>]+>/g, "").trim() : "";

    let link = titleMatch ? titleMatch[1] : "";
    if (link.startsWith("//")) link = `https:${link}`;
    if (link.includes("duckduckgo.com/l/?uddg=")) {
      try {
        const parsedLink = new URL(link, "https://html.duckduckgo.com");
        const real = parsedLink.searchParams.get("uddg");
        if (real) link = decodeURIComponent(real);
      } catch {}
    }

    const titleAnchor = /<a class="result__a"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    const title = titleAnchor
      ? titleAnchor[1].replace(/<[^>]+>/g, "").trim()
      : link;

    if (link && link.startsWith("http")) {
      results.push({
        title: decodeHtmlEntities(title),
        url: link,
        snippet: decodeHtmlEntities(snippetText),
      });
    }
  }

  if (results.length === 0) {
    return `No search results found for query: "${trimmed}".`;
  }

  return results
    .map(
      (r, i) =>
        `${i + 1}. **[${r.title}](${r.url})**\n   ${r.snippet || "No description available."}`,
    )
    .join("\n\n");
}
