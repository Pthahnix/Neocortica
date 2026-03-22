import { readFileSync } from "fs";
import { normTitle } from "../utils/misc.js";
import { loadMarkdownPath } from "../utils/cache.js";

export interface ContentQuery {
  normalizedTitle?: string;
  title?: string;
}

export interface ContentResult {
  content: string;
  markdownPath: string;
}

/** Read cached markdown content by title or normalizedTitle. Pure local, no network. */
export function paperContent(query: ContentQuery): ContentResult | null {
  const nt = query.normalizedTitle ?? (query.title ? normTitle(query.title) : "");
  if (!nt) return null;

  const markdownPath = loadMarkdownPath(nt);
  if (!markdownPath) return null;

  const content = readFileSync(markdownPath, "utf-8");
  return { content, markdownPath };
}
