import type { PaperMeta } from "../types.js";
import { normTitle } from "./misc.js";

const BASE = "https://api.semanticscholar.org/graph/v1";
const FIELDS =
  "title,year,authors,abstract,citationCount,externalIds,openAccessPdf,url";

async function fetchJson(url: string): Promise<any> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

export function mapPaper(p: any): PaperMeta | null {
  if (!p || !p.title) return null;
  const exIds = p.externalIds ?? {};
  const arxivId = exIds.ArXiv ?? undefined;
  const doi = exIds.DOI ?? undefined;
  const authors = Array.isArray(p.authors)
    ? p.authors.map((a: any) => a.name).join(", ")
    : undefined;
  return {
    title: p.title,
    normalizedTitle: normTitle(p.title),
    arxivId,
    doi,
    s2Id: p.paperId ?? undefined,
    year: p.year ?? undefined,
    authors,
    abstract: p.abstract ?? undefined,
    citationCount: p.citationCount ?? undefined,
    arxivUrl: arxivId ? `https://arxiv.org/abs/${arxivId}` : undefined,
    oaPdfUrl: p.openAccessPdf?.url ?? undefined,
    sourceUrl: p.url ?? undefined,
  };
}

/** Find a paper by title using Semantic Scholar search/match. */
export async function query(title: string): Promise<PaperMeta | null> {
  const url = `${BASE}/paper/search/match?query=${encodeURIComponent(title)}&fields=${FIELDS}`;
  const data = await fetchJson(url);
  if (!data?.data?.[0]) return null;
  return mapPaper(data.data[0]);
}

/** Get all references of a paper. Accepts s2Id, "ARXIV:id", or "DOI:doi". Paginates automatically. */
export async function references(paperId: string): Promise<PaperMeta[]> {
  const all: PaperMeta[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = `${BASE}/paper/${encodeURIComponent(paperId)}/references?fields=${FIELDS}&limit=${limit}&offset=${offset}`;
    const data = await fetchJson(url);
    if (!data?.data) break;

    for (const r of data.data) {
      const p = mapPaper(r.citedPaper);
      if (p) all.push(p);
    }

    if (data.next === undefined || data.data.length < limit) break;
    offset = data.next;
  }

  return all;
}
