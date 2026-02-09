import { loadPaper } from '../src/arxiv.ts';
import { readdir } from 'fs/promises';

const PAPER_DIR = 'paper';

async function listPapers(): Promise<string[]> {
  try { return (await readdir(PAPER_DIR)).filter(f => f.endsWith('.md')); }
  catch { return []; }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) { console.error(`FAIL: ${msg}`); process.exit(1); }
  console.log(`  PASS: ${msg}`);
}

// ═══════════════════════════════════════════════════════════════════════
// Test 1: APIFY scenario — gpt-oss-120b & gpt-oss-20b model card
//   APIFY gives us both title and link.
//   We pass the link as `paper` and the title as `knownTitle`.
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Test 1: APIFY scenario (gpt-oss) ===');
const md1 = await loadPaper(
  'https://arxiv.org/abs/2508.10925',
  'gpt-oss-120b & gpt-oss-20b model card'
);
assert(md1.startsWith('# gpt-oss-120b & gpt-oss-20b model card'), 'starts with correct H1');
assert(md1.length > 1000, `content is substantial (${md1.length} chars)`);

let papers = await listPapers();
assert(papers.includes('2508.10925-gpt-oss-120b-gpt-oss-20b-model-card.md'), 'file saved with correct name');

// ═══════════════════════════════════════════════════════════════════════
// Test 2: Human scenario A — title only
//   'GPT-4 Technical Report' → should search arXiv, fetch, save.
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Test 2: Human — title only ===');
const md2 = await loadPaper('GPT-4 Technical Report');
assert(md2.startsWith('# GPT-4 Technical Report'), 'starts with correct H1');
assert(md2.length > 1000, `content is substantial (${md2.length} chars)`);

papers = await listPapers();
assert(papers.some(f => f.startsWith('2303.08774')), 'file saved with correct id prefix');

// ═══════════════════════════════════════════════════════════════════════
// Test 3: Human scenario B — URL only (should cache hit now)
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Test 3: Human — URL only (cache hit) ===');
const md3 = await loadPaper('https://arxiv.org/abs/2303.08774');
assert(md3.startsWith('# GPT-4 Technical Report'), 'starts with correct H1');
assert(md3.length === md2.length, 'same content as title-based fetch');

// ═══════════════════════════════════════════════════════════════════════
// Test 4: Human scenario C — id only (should cache hit now)
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Test 4: Human — id only (cache hit) ===');
const md4 = await loadPaper('2303.08774');
assert(md4.startsWith('# GPT-4 Technical Report'), 'starts with correct H1');
assert(md4.length === md2.length, 'same content as title-based fetch');

// ═══════════════════════════════════════════════════════════════════════
// Test 5: APIFY gpt-oss cache hit (no re-fetch)
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Test 5: APIFY gpt-oss (cache hit) ===');
const md5 = await loadPaper(
  'https://arxiv.org/abs/2508.10925',
  'gpt-oss-120b & gpt-oss-20b model card'
);
assert(md5.length === md1.length, 'same content from cache');

// ═══════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Final state of paper/ ===');
papers = await listPapers();
for (const p of papers) console.log(`  ${p}`);

console.log('\nAll tests passed.');
