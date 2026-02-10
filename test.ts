import { PaperSearcher } from './src/arxiv.ts';

const searcher = new PaperSearcher();

// ── Helper ───────────────────────────────────────────────────────────

async function run(label: string, input: { title: any, id: any, url: any }) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${'='.repeat(60)}`);
  console.log('input:', JSON.stringify(input));

  const ctx: any = {
    paperTitle: input.title ?? '',
    paperId:    input.id    ?? '',
    paperUrl:   input.url   ?? '',
  };

  ctx.paperId    = searcher.paperId(ctx);
  console.log('paperId:   ', ctx.paperId);

  ctx.paperTitle = await searcher.paperTitle(ctx);
  console.log('paperTitle:', ctx.paperTitle);

  ctx.paperUrl   = searcher.paperUrl(ctx);
  console.log('paperUrl:  ', ctx.paperUrl);

  ctx.paperFile  = searcher.paperFile(ctx);
  console.log('paperFile: ', ctx.paperFile);

  ctx.paperMd    = await searcher.paperMd(ctx);
  console.log('paperMd:   ', ctx.paperMd.length, 'chars');

  // final context
  const output = { title: ctx.paperTitle, url: ctx.paperUrl, markdown: ctx.paperMd };
  console.log('\n--- output context ---');
  console.log('title:   ', output.title);
  console.log('url:     ', output.url);
  console.log('markdown:', output.markdown.length, 'chars');
}

// ── Test 1: Human (id only) ─────────────────────────────────────────

await run('Human: id = 2205.14135', {
  title: null,
  id: '2205.14135',
  url: null,
});

// ── Test 2: APIFY (title + url) ─────────────────────────────────────

await run('APIFY: title + url', {
  title: 'Training Large Language Models to Reason in a Continuous Latent Space',
  id: null,
  url: 'https://arxiv.org/abs/2412.06769',
});

// npx tsx test.ts
