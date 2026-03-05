// ── Shared Types ────────────────────────────────────────────────────

export interface PaperResult {
  // identifiers
  title: string;
  normalizedTitle: string;
  arxivId?: string;
  doi?: string;
  s2Id?: string;

  // metadata
  year?: number;
  authors?: string;
  abstract?: string;
  citationCount?: number;

  // urls
  arxivUrl?: string;
  pdfUrl?: string;
  sourceUrl?: string;

  // cache
  markdownDir?: string;
}

export interface WebResult {
  title: string;
  normalizedTitle: string;
  url: string;
  description?: string;
  markdownDir?: string;
}
