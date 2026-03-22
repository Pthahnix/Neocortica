import { basename } from "path";
import type { PaperMeta } from "../types.js";
import * as arxiv from "../utils/arxiv.js";
import * as pdf from "../utils/pdf.js";
import * as cache from "../utils/cache.js";
import { normTitle } from "../utils/misc.js";
import type { ProgressCallback } from "../utils/pdf.js";

/**
 * paper_fetching tool: fetch paper markdown given PaperMeta with URLs.
 * Cache-first: checks local cache before network calls.
 */
export async function paperFetching(
  meta: PaperMeta,
  onProgress?: ProgressCallback,
): Promise<PaperMeta> {
  // 0. When pdfPath is set, derive normalizedTitle (always) and title (if missing) from filename
  if (meta.pdfPath) {
    const stem = basename(meta.pdfPath, ".pdf");
    meta.normalizedTitle = normTitle(stem);
    if (!meta.title) meta.title = stem;
  }

  // 1. Check cache
  const cachedPath = cache.loadMarkdownPath(meta.normalizedTitle);
  if (cachedPath) {
    meta.markdownPath = cachedPath;
    return meta;
  }

  // 2. Try local PDF via MinerU
  if (meta.pdfPath) {
    await onProgress?.({ message: `Converting local PDF via MinerU: ${meta.pdfPath}` });
    const md = await pdf.content(meta.pdfPath, onProgress);
    if (md) {
      meta.markdownPath = cache.saveMarkdown(meta.title, md);
      cache.saveMeta(meta);
      return meta;
    }
  }

  // 3. Try arxiv2md
  if (meta.arxivUrl) {
    await onProgress?.({ message: `Fetching via arxiv2md: ${meta.arxivUrl}` });
    const md = await arxiv.content(meta.arxivUrl);
    if (md) {
      meta.markdownPath = cache.saveMarkdown(meta.title, md);
      cache.saveMeta(meta);
      return meta;
    }

    // 3.5 arxiv2md failed — fallback to arxiv PDF URL via MinerU
    if (meta.arxivId) {
      const arxivPdfUrl = `https://arxiv.org/pdf/${meta.arxivId}`;
      await onProgress?.({ message: `arxiv2md failed, fallback to arxiv PDF via MinerU: ${arxivPdfUrl}` });
      const md = await pdf.content(arxivPdfUrl, onProgress);
      if (md) {
        meta.markdownPath = cache.saveMarkdown(meta.title, md);
        cache.saveMeta(meta);
        return meta;
      }
    }
  }

  // 4. Try MinerU PDF conversion
  if (meta.oaPdfUrl) {
    await onProgress?.({ message: `Fetching PDF via MinerU: ${meta.oaPdfUrl}` });
    const md = await pdf.content(meta.oaPdfUrl, onProgress);
    if (md) {
      meta.markdownPath = cache.saveMarkdown(meta.title, md);
      cache.saveMeta(meta);
      return meta;
    }
  }

  // 5. No full text available
  cache.saveMeta(meta);
  return meta;
}
