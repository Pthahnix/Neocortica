import { readFileSync } from "fs";
import type { PaperMeta } from "../types.js";
import { normTitle } from "../utils/misc.js";
import * as ss from "../utils/ss.js";
import { enrichMeta } from "./paper_searching.js";

/** Extract reference titles from markdown (fallback strategy). */
function extractReferenceTitles(markdown: string): string[] {
  const refMatch = markdown.match(
    /^#{1,3}\s*(?:references|bibliography|works cited)\s*$/im,
  );
  if (!refMatch || refMatch.index === undefined) return [];

  const refSection = markdown.slice(refMatch.index + refMatch[0].length);
  const nextHeading = refSection.match(/^#{1,3}\s+/m);
  const content = nextHeading?.index
    ? refSection.slice(0, nextHeading.index)
    : refSection;

  const titles: string[] = [];

  // Numbered: [1] Author. "Title." or [1] Author. Title.
  const numbered = content.matchAll(
    /\[\d+\]\s*[^.]+?\.\s*(?:"([^"]+?)\."?|([A-Z][^.]{15,}?)\.)/g,
  );
  for (const m of numbered) {
    const t = (m[1] || m[2])?.trim();
    if (t && t.length > 10) titles.push(t);
  }

  // Bulleted fallback
  if (titles.length === 0) {
    const bulleted = content.matchAll(
      /^[-*]\s+[^.]+?\.\s*(?:"([^"]+?)\."?|([A-Z][^.]{15,}?)\.)/gm,
    );
    for (const m of bulleted) {
      const t = (m[1] || m[2])?.trim();
      if (t && t.length > 10) titles.push(t);
    }
  }

  return titles;
}

/** Determine SS-compatible paper ID from PaperMeta. */
function resolvePaperId(meta: PaperMeta): string | null {
  if (meta.s2Id) return meta.s2Id;
  if (meta.arxivId) return `ARXIV:${meta.arxivId}`;
  if (meta.doi) return `DOI:${meta.doi}`;
  return null;
}

/** paper_reference tool: get all references of a paper. SS API primary, markdown fallback. */
export async function paperReference(meta: PaperMeta): Promise<PaperMeta[]> {
  const paperId = resolvePaperId(meta);

  // Primary path: SS references API
  if (paperId) {
    try {
      const refs = await ss.references(paperId);
      if (refs.length > 0) return refs;
    } catch { /* fall through */ }
  }

  // Fallback: parse markdown
  if (meta.markdownPath) {
    try {
      const markdown = readFileSync(meta.markdownPath, "utf-8");
      const titles = extractReferenceTitles(markdown);
      if (titles.length === 0) return [];

      const results: PaperMeta[] = [];
      for (let i = 0; i < titles.length; i += 3) {
        const batch = titles.slice(i, i + 3);
        const settled = await Promise.allSettled(
          batch.map((title) => enrichMeta({ title, normalizedTitle: normTitle(title) })),
        );
        for (const s of settled) {
          if (s.status === "fulfilled") results.push(s.value);
        }
      }
      return results;
    } catch { /* fall through */ }
  }

  return [];
}

// Re-export for testing
export { extractReferenceTitles };
