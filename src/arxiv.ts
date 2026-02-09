// src/arxiv.ts — arXiv paper utility functions

import 'dotenv/config';
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { XMLParser } from 'fast-xml-parser';

// ── Constants ────────────────────────────────────────────────────────

const ARXIV_ABS_URL:    string = 'https://arxiv.org/abs/';
const ARXIV_API_URL:    string = process.env['BASE_URL_ARXIV']    ?? 'http://export.arxiv.org/api/query';
const ARXIV2MD_API_URL: string = process.env['BASE_URL_ARXIV2MD'] ?? 'https://arxiv2md.org/api/ingest';

const ARXIV_ID_PATTERN: RegExp = /^\d{4}\.\d{4,5}(v\d+)?$/;
const ARXIV_URL_PATTERN: RegExp = /^https?:\/\/arxiv\.org\/abs\/(\d{4}\.\d{4,5}(v\d+)?)$/;

const PAPER_DIR: string = 'paper';

// ── Types ────────────────────────────────────────────────────────────

export interface PaperInfo {
  id:    string | null;
  title: string | null;
  url:   string | null;
}

// ── Internal Helpers ─────────────────────────────────────────────────

/** Strip version suffix: '2303.08774v6' → '2303.08774' */
function stripVersion(id: string): string {
  return id.replace(/v\d+$/, '');
}

export function parseInput(paper: string): { type: 'id' | 'url' | 'title'; id: string | null } {
  const trimmed: string = paper.trim();
  const urlMatch: RegExpMatchArray | null = trimmed.match(ARXIV_URL_PATTERN);
  if (urlMatch) return { type: 'url', id: stripVersion(urlMatch[1]) };
  if (ARXIV_ID_PATTERN.test(trimmed)) return { type: 'id', id: stripVersion(trimmed) };
  return { type: 'title', id: null };
}

export function getPaperUrlById(paperId: string): string {
  return ARXIV_ABS_URL + paperId.trim();
}

export async function searchByTitle(title: string): Promise<PaperInfo | null> {
  const params = new URLSearchParams({ search_query: `ti:"${title}"`, max_results: '5' });
  const resp: Response = await fetch(`${ARXIV_API_URL}?${params}`);
  if (!resp.ok) return null;

  const xml: string = await resp.text();
  const parser = new XMLParser();
  const parsed = parser.parse(xml);

  const feed = parsed?.feed;
  if (!feed) return null;

  const entries: any[] = Array.isArray(feed.entry) ? feed.entry : feed.entry ? [feed.entry] : [];
  const titleLower: string = title.toLowerCase();

  for (const entry of entries) {
    const entryTitle: string = String(entry.title ?? '').replace(/\s+/g, ' ').trim();
    if (entryTitle.toLowerCase() === titleLower) {
      const idUrl: string = String(entry.id ?? '');
      const id: string = stripVersion(idUrl.split('/abs/').pop() ?? '');
      return { id, title: entryTitle, url: ARXIV_ABS_URL + id };
    }
  }
  return null;
}

export async function getTitleById(paperId: string): Promise<string | null> {
  const params = new URLSearchParams({ id_list: paperId.trim() });
  const resp: Response = await fetch(`${ARXIV_API_URL}?${params}`);
  if (!resp.ok) return null;

  const xml: string = await resp.text();
  const parser = new XMLParser();
  const parsed = parser.parse(xml);

  const feed = parsed?.feed;
  if (!feed) return null;

  const entry = Array.isArray(feed.entry) ? feed.entry[0] : feed.entry;
  if (!entry?.title) return null;

  return String(entry.title).replace(/\s+/g, ' ').trim();
}

// ── Core Functions ───────────────────────────────────────────────────

export async function resolvePaper(paper: string, knownTitle?: string): Promise<PaperInfo> {
  const input = parseInput(paper);
  const info: PaperInfo = { id: input.id, title: knownTitle ?? null, url: null };

  switch (input.type) {
    case 'url':
      // id already extracted from URL by parseInput
      info.url = getPaperUrlById(info.id!);
      if (!info.title) info.title = await getTitleById(info.id!);
      break;

    case 'id':
      info.url = getPaperUrlById(info.id!);
      if (!info.title) info.title = await getTitleById(info.id!);
      break;

    case 'title': {
      // If knownTitle wasn't provided, use the input itself as title for searching
      const searchTitle: string = info.title ?? paper.trim();
      const result: PaperInfo | null = await searchByTitle(searchTitle);
      if (result) {
        info.id    = result.id;
        info.title = result.title;
        info.url   = result.url;
      } else {
        info.title = searchTitle;
      }
      break;
    }
  }

  return info;
}

export async function getPaperMd(paperUrl: string, paperTitle: string): Promise<string> {
  const resp: Response = await fetch(ARXIV2MD_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input_text: paperUrl }),
  });
  if (!resp.ok) throw new Error(`arxiv2md request failed with status ${resp.status}`);
  const data = await resp.json() as { content?: string };
  const content: string = data.content ?? '';
  if (!content) throw new Error('arxiv2md returned empty content');
  return '# ' + paperTitle + '\n\n' + content;
}

export function titleToFilename(title: string): string {
  let name: string = title.toLowerCase();
  name = name.replace(/[^a-z0-9\s-]/g, '');
  name = name.replace(/[\s-]+/g, '-').replace(/^-|-$/g, '');
  return name;
}

export async function savePaper(paperMd: string, paperTitle: string, paperId: string): Promise<string> {
  await mkdir(PAPER_DIR, { recursive: true });
  const filename: string = paperId + '-' + titleToFilename(paperTitle) + '.md';
  const filepath: string = join(PAPER_DIR, filename);
  await writeFile(filepath, paperMd, 'utf-8');
  return filepath;
}

export async function loadPaper(paper: string, knownTitle?: string): Promise<string> {
  // Step 1: try to extract id early (without network) for cache check
  const input = parseInput(paper);
  const earlyId: string | null = input.id;

  // Step 2: check local cache by id (before any network calls)
  if (earlyId) {
    try {
      const files: string[] = await readdir(PAPER_DIR);
      const match: string | undefined = files.find(f => f.startsWith(earlyId) && f.endsWith('.md'));
      if (match) {
        const content: string = await readFile(join(PAPER_DIR, match), 'utf-8');
        console.log(`[loadPaper] cache hit: ${match}`);
        return content;
      }
    } catch {
      // PAPER_DIR doesn't exist yet — will be created by savePaper
    }
  }

  // Step 3: resolve full paper info (may involve network calls)
  const info: PaperInfo = await resolvePaper(paper, knownTitle);

  // Step 4: if id was resolved from title search, check cache again
  if (!earlyId && info.id) {
    try {
      const files: string[] = await readdir(PAPER_DIR);
      const match: string | undefined = files.find(f => f.startsWith(info.id!) && f.endsWith('.md'));
      if (match) {
        const content: string = await readFile(join(PAPER_DIR, match), 'utf-8');
        console.log(`[loadPaper] cache hit: ${match}`);
        return content;
      }
    } catch {
      // PAPER_DIR doesn't exist yet
    }
  }

  // Step 5: fetch, save, and return
  if (!info.url || !info.title || !info.id) {
    throw new Error(`Cannot resolve paper: ${paper}`);
  }
  console.log(`[loadPaper] cache miss, fetching: ${info.url}`);
  const md: string = await getPaperMd(info.url, info.title);
  await savePaper(md, info.title, info.id);
  return md;
}
