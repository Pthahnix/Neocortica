/** Google Scholar scraper raw output (apify marco.gullo/google-scholar-scraper). */
export interface ScholarItem {
  title?: string;
  link?: string;
  authors?: string;
  year?: string | number;
  citations?: string | number;
  searchMatch?: string;
  documentLink?: string;
}

export interface PaperMeta {
  title: string;
  normalizedTitle: string;
  // identifiers
  arxivId?: string;
  doi?: string;
  s2Id?: string;
  // metadata
  abstract?: string;
  arxivUrl?: string;
  oaPdfUrl?: string;
  pdfPath?: string;
  year?: number;
  authors?: string;
  citationCount?: number;
  sourceUrl?: string;
  // cache
  markdownPath?: string;
}
