// src/routes.ts — API routes

import { Hono } from 'hono';
import { PaperSearcher } from './arxiv.js';
import { PaperReader } from './paper_reader.js';
import { paperReadingSystem } from '../prompt/paper_reading.js';

const routes = new Hono();
const searcher = new PaperSearcher();

// ── Auth middleware ──────────────────────────────────────────────────

routes.use('*', async (c, next) => {
  const expected = process.env['NEOCORTICA_API_KEY'];
  if (expected) {
    const provided = c.req.header('X-API-Key');
    if (provided !== expected) {
      return c.json({ error: 'unauthorized' }, 401);
    }
  }
  await next();
});

// ── Helpers ─────────────────────────────────────────────────────────

async function resolvePaper(args: { id?: string; url?: string; title?: string }) {
  const ctx = {
    paperTitle: args.title ?? '',
    paperId:    args.id ?? '',
    paperUrl:   args.url ?? '',
  };
  ctx.paperId = searcher.paperId(ctx);
  ctx.paperTitle = await searcher.paperTitle(ctx);
  ctx.paperUrl = searcher.paperUrl(ctx);
  const paperFile = searcher.paperFile(ctx);
  return { ...ctx, paperFile };
}

function makeReader(systemPrompt: string) {
  return new PaperReader({
    baseUrl:   process.env['BASE_URL_MODEL']!,
    apiKey:    process.env['API_KEY_MODEL']!,
    modelName: process.env['MODEL_NAME']!,
    systemPrompt,
  });
}

// ── POST /search ────────────────────────────────────────────────────

routes.post('/search', async (c) => {
  try {
    const body = await c.req.json<{ id?: string; url?: string; title?: string }>();
    const ctx = await resolvePaper(body);
    const markdown = await searcher.paperMd(ctx);
    return c.json({ title: ctx.paperTitle, url: ctx.paperUrl, markdown });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ error: msg }, 400);
  }
});

// ── POST /read ──────────────────────────────────────────────────────

routes.post('/read', async (c) => {
  try {
    const body = await c.req.json<{ id?: string; url?: string; title?: string; prompt?: string }>();
    const ctx = await resolvePaper(body);
    const markdown = await searcher.paperMd(ctx);

    const reader = makeReader(paperReadingSystem);
    const userPrompt = body.prompt ?? 'Read this paper and provide a structured analysis.';
    const input = `${userPrompt}\n\n---\n\n${markdown}`;
    const completion = await reader.call(input);
    const response = completion.choices[0]?.message?.content ?? '';

    return c.json({ title: ctx.paperTitle, url: ctx.paperUrl, response });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ error: msg }, 400);
  }
});

export { routes as paperRoutes };
