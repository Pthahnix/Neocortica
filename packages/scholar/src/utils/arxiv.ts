import { XMLParser } from "fast-xml-parser";
import type { PaperMeta } from "../types.js";
import { normTitle } from "./misc.js";

const BASE_ARXIV = "https://arxiv.org/abs/";
const BASE_API = "https://export.arxiv.org/api/query";
const BASE_ARXIV2MD = "https://arxiv2md.org/api/ingest";

export function urlToId(url: string): string {
  const m = url.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})(?:v\d+)?/i);
  if (!m) throw new Error(`invalid arxiv url: ${url}`);
  return m[1];
}

export function idToUrl(id: string): string {
  return BASE_ARXIV + id.replace(/^arXiv:/i, "").replace(/v\d+$/, "");
}

export function parseEntry(entry: any): PaperMeta | null {
  if (!entry?.title) return null;
  const id = entry.id ? urlToId(String(entry.id)) : undefined;
  const authors = Array.isArray(entry.author)
    ? entry.author.map((a: any) => a?.name ?? a).join(", ")
    : String(entry.author?.name ?? entry.author ?? "");
  const published = entry.published ? String(entry.published) : undefined;
  const title = String(entry.title).replace(/\s+/g, " ").trim();
  return {
    title,
    normalizedTitle: normTitle(title),
    arxivId: id,
    arxivUrl: id ? idToUrl(id) : undefined,
    authors,
    year: published ? parseInt(published.slice(0, 4), 10) : undefined,
    abstract: entry.summary
      ? String(entry.summary).replace(/\s+/g, " ").trim()
      : undefined,
  };
}

/** Fetch full markdown of an arXiv paper via arxiv2md.org. */
export async function content(url: string): Promise<string | null> {
  try {
    const id = urlToId(url);
    const absUrl = idToUrl(id);
    const resp = await fetch(BASE_ARXIV2MD, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input_text: absUrl }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { content?: string };
    return data.content || null;
  } catch {
    return null;
  }
}

/** Search arXiv by title. Returns best match or null. */
export async function query(title: string): Promise<PaperMeta | null> {
  try {
    const params = new URLSearchParams({
      search_query: `ti:"${title}"`,
      max_results: "1",
    });
    const resp = await fetch(`${BASE_API}?${params}`);
    if (!resp.ok) return null;
    const parsed = new XMLParser().parse(await resp.text());
    const entry = Array.isArray(parsed?.feed?.entry)
      ? parsed.feed.entry[0]
      : parsed?.feed?.entry;
    return parseEntry(entry);
  } catch {
    return null;
  }
}

/** Query arXiv by paper ID. Returns metadata or null. */
export async function queryById(id: string): Promise<PaperMeta | null> {
  try {
    const cleanId = id.replace(/^arXiv:/i, "").replace(/v\d+$/, "");
    const params = new URLSearchParams({ id_list: cleanId, max_results: "1" });
    const resp = await fetch(`${BASE_API}?${params}`);
    if (!resp.ok) return null;
    const parsed = new XMLParser().parse(await resp.text());
    const entry = Array.isArray(parsed?.feed?.entry)
      ? parsed.feed.entry[0]
      : parsed?.feed?.entry;
    return parseEntry(entry);
  } catch {
    return null;
  }
}
