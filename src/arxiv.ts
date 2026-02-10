// src/arxiv.ts — PaperSearcher

import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { XMLParser } from 'fast-xml-parser';

// ── Constants ────────────────────────────────────────────────────────

const ARXIV_ABS_URL    = 'https://arxiv.org/abs/';
const ARXIV_API_URL    = process.env['BASE_URL_ARXIV']    ?? 'http://export.arxiv.org/api/query';
const ARXIV2MD_API_URL = process.env['BASE_URL_ARXIV2MD'] ?? 'https://arxiv2md.org/api/ingest';
const ARXIV_URL_RE     = /^https?:\/\/arxiv\.org\/abs\/(\d{4}\.\d{4,5}(v\d+)?)$/;
const PAPER_DIR        = '.paper';

// ── PaperSearcher ───────────────────────────────────────────────────

export class PaperSearcher {

  private stripVersion(id: string): string {
    return id.replace(/v\d+$/, '');
  }

  private titleToFilename(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-').replace(/^-|-$/g, '');
  }

  paperId(ctx: { paperTitle: string, paperId: string, paperUrl: string }): string {
    if (ctx.paperUrl) {
      const m = ctx.paperUrl.match(ARXIV_URL_RE);
      if (m) return this.stripVersion(m[1]);
    }
    if (ctx.paperId) return this.stripVersion(ctx.paperId);
    throw new Error('need at least paperUrl or paperId');
  }

  async paperTitle(ctx: { paperTitle: string, paperId: string, paperUrl: string }): Promise<string> {
    if (ctx.paperTitle) return ctx.paperTitle;
    const params = new URLSearchParams({ id_list: ctx.paperId });
    const resp = await fetch(`${ARXIV_API_URL}?${params}`);
    if (!resp.ok) throw new Error(`arXiv API ${resp.status}`);
    const parsed = new XMLParser().parse(await resp.text());
    const entry = Array.isArray(parsed?.feed?.entry) ? parsed.feed.entry[0] : parsed?.feed?.entry;
    if (!entry?.title) throw new Error(`no title found for ${ctx.paperId}`);
    return String(entry.title).replace(/\s+/g, ' ').trim();
  }

  paperUrl(ctx: { paperTitle: string, paperId: string, paperUrl: string }): string {
    if (ctx.paperUrl) return ctx.paperUrl;
    return ARXIV_ABS_URL + ctx.paperId;
  }

  paperFile(ctx: { paperTitle: string, paperId: string, paperUrl: string }): string {
    return join(PAPER_DIR, ctx.paperId + '-' + this.titleToFilename(ctx.paperTitle) + '.md');
  }

  async paperMd(ctx: { paperTitle: string, paperId: string, paperUrl: string, paperFile: string }): Promise<string> {
    // cache hit
    if (existsSync(ctx.paperFile)) {
      console.log(`[paperMd] cache hit: ${ctx.paperFile}`);
      return readFile(ctx.paperFile, 'utf-8');
    }
    // cache miss — fetch from arxiv2md
    console.log(`[paperMd] cache miss, fetching: ${ctx.paperUrl}`);
    const resp = await fetch(ARXIV2MD_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input_text: ctx.paperUrl }),
    });
    if (!resp.ok) throw new Error(`arxiv2md ${resp.status}`);
    const data = await resp.json() as { content?: string };
    if (!data.content) throw new Error('arxiv2md returned empty');
    const md = '# ' + ctx.paperTitle + '\n\n' + data.content;
    // save
    await mkdir(PAPER_DIR, { recursive: true });
    await writeFile(ctx.paperFile, md, 'utf-8');
    console.log(`[paperMd] saved: ${ctx.paperFile}`);
    return md;
  }
}
