/**
 * Aggregator for user-configured skill market sources.
 *
 * Lives in the main process because the renderer's CSP only allows localhost
 * connections. Document fetching (for preview and install) also sits here for
 * the same CSP reason; the actual write goes through the existing
 * `skills.create` path on the renderer's side.
 */
import { net } from "electron";
import type { SkillCatalogEntry, SkillMarketSource } from "@pi-desktop/shared";
import { createPublicHttpsClient } from "./public-https-fetch";
import {
  createSkillMarketAggregator,
  type SkillMarketDocument,
  type SkillMarketSearchResult,
} from "./skill-market-scan";

export type { SkillMarketDocument, SkillMarketSearchResult } from "./skill-market-scan";
export { guessSkillCategories } from "./skill-market-scan";

const client = createPublicHttpsClient({ fetchImpl: (url, init) => net.fetch(url, init) });
const aggregator = createSkillMarketAggregator(client.request);

export function searchSkillMarket(
  query: string,
  sources: SkillMarketSource[],
): Promise<SkillMarketSearchResult> {
  return aggregator.search(query, sources);
}

export function fetchSkillMarketDocument(entry: SkillCatalogEntry): Promise<SkillMarketDocument> {
  return aggregator.fetchEntryDocument(entry);
}
