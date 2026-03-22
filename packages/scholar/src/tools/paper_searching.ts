import type { PaperMeta, ScholarItem } from "../types.js";
import { normTitle } from "../utils/misc.js";
import * as arxiv from "../utils/arxiv.js";
import * as ss from "../utils/ss.js";
import * as unpaywall from "../utils/unpaywall.js";

/** Parse base fields from apify scraper output. */
export function parseScholarItem(item: ScholarItem): PaperMeta {
  const title = item.title ?? "";
  const arxivMatch = (item.link ?? "").match(
    /arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/i,
  );
  const arxivId = arxivMatch ? arxivMatch[1] : undefined;
  const yearMatch = String(item.year ?? "").match(/(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

  return {
    title,
    normalizedTitle: normTitle(title),
    arxivId,
    arxivUrl: arxivId ? `https://arxiv.org/abs/${arxivId}` : undefined,
    year,
    authors: item.authors ?? undefined,
    abstract: item.searchMatch ?? undefined,
    citationCount: item.citations != null ? Number(item.citations) : undefined,
    sourceUrl: item.link ?? undefined,
  };
}

/**
 * Enrich a PaperMeta. Pipeline: ① arxivUrl already? ② arXiv search ③ SS search ④ Unpaywall
 */
export async function enrichMeta(meta: PaperMeta): Promise<PaperMeta> {
  // ① Already have arxivUrl — done
  if (meta.arxivUrl) return meta;

  // ② arXiv title search
  const arxivResult = await arxiv.query(meta.title);
  if (arxivResult?.arxivUrl) {
    meta.arxivId = arxivResult.arxivId;
    meta.arxivUrl = arxivResult.arxivUrl;
    if (!meta.abstract) meta.abstract = arxivResult.abstract;
    if (!meta.authors) meta.authors = arxivResult.authors;
    if (!meta.year) meta.year = arxivResult.year;
    return meta;
  }

  // ③ SS title search (only if arXiv failed)
  const ssResult = await ss.query(meta.title);
  if (ssResult) {
    if (!meta.s2Id) meta.s2Id = ssResult.s2Id;
    if (!meta.doi) meta.doi = ssResult.doi;
    if (!meta.year) meta.year = ssResult.year;
    if (!meta.authors) meta.authors = ssResult.authors;
    if (!meta.abstract) meta.abstract = ssResult.abstract;
    if (!meta.citationCount) meta.citationCount = ssResult.citationCount;
    if (!meta.sourceUrl) meta.sourceUrl = ssResult.sourceUrl;

    // SS may reveal arXiv ID
    if (ssResult.arxivId) {
      meta.arxivId = ssResult.arxivId;
      meta.arxivUrl = ssResult.arxivUrl;
      return meta;
    }

    // SS may have oaPdfUrl
    if (!meta.oaPdfUrl && ssResult.oaPdfUrl) {
      meta.oaPdfUrl = ssResult.oaPdfUrl;
    }

    // ④ Unpaywall: has DOI but still no oaPdfUrl
    if (meta.doi && !meta.oaPdfUrl) {
      try {
        const upResult = await unpaywall.query(meta.doi);
        if (upResult?.oaPdfUrl) meta.oaPdfUrl = upResult.oaPdfUrl;
      } catch { /* EMAIL may not be set */ }
    }
  }

  return meta;
}

/** paper_searching tool: parse Scholar item + enrich metadata. */
export async function paperSearching(item: ScholarItem): Promise<PaperMeta> {
  const meta = parseScholarItem(item);
  return enrichMeta(meta);
}
