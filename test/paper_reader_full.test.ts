import { PaperReader } from '../src/paper_reader.ts';
import type { PaperReaderInput } from '../src/paper_reader.ts';
import { paperReadingSystem, paperReading00, paperReading01, paperReading02 } from '../prompt/paper_reading.ts';
import { loadPaper } from '../src/arxiv.ts';

// ── Load paper ───────────────────────────────────────────────────────
const markdown: string = await loadPaper('2508.10925');
console.log(`Paper loaded: ${markdown.length} chars\n`);

// ── Config shared across all 3 readers ───────────────────────────────
const baseConfig = {
  baseUrl:      process.env['BASE_URL_OPENROUTER']!,
  apiKey:       process.env['API_KEY_OPENROUTER']!,
  modelName:    'openai/gpt-oss-120b',
  systemPrompt: paperReadingSystem,
};

// ── Step 0: Quick Scan ───────────────────────────────────────────────
console.log('=== Step 0: Quick Scan ===');
const reader0 = new PaperReader({ ...baseConfig, promptTemplate: paperReading00 });
const resp0 = await reader0.call({ response: [], markdown });
const content0: string = resp0.choices[0]?.message.content ?? '';
console.log(`Response: ${content0.length} chars`);
console.log(`Tokens: prompt=${resp0.usage?.prompt_tokens} completion=${resp0.usage?.completion_tokens} total=${resp0.usage?.total_tokens}`);
console.log(`Preview: ${content0.slice(0, 200)}...\n`);

// ── Step 1: Deep Dive ────────────────────────────────────────────────
console.log('=== Step 1: Deep Dive ===');
const reader1 = new PaperReader({ ...baseConfig, promptTemplate: paperReading01 });
const input1: PaperReaderInput = { response: [content0], markdown };
const resp1 = await reader1.call(input1);
const content1: string = resp1.choices[0]?.message.content ?? '';
console.log(`Response: ${content1.length} chars`);
console.log(`Tokens: prompt=${resp1.usage?.prompt_tokens} completion=${resp1.usage?.completion_tokens} total=${resp1.usage?.total_tokens}`);
console.log(`Preview: ${content1.slice(0, 200)}...\n`);

// ── Step 2: Critical Thinking ────────────────────────────────────────
console.log('=== Step 2: Critical Thinking ===');
const reader2 = new PaperReader({ ...baseConfig, promptTemplate: paperReading02 });
const input2: PaperReaderInput = { response: [content0, content1], markdown };
const resp2 = await reader2.call(input2);
const content2: string = resp2.choices[0]?.message.content ?? '';
console.log(`Response: ${content2.length} chars`);
console.log(`Tokens: prompt=${resp2.usage?.prompt_tokens} completion=${resp2.usage?.completion_tokens} total=${resp2.usage?.total_tokens}`);
console.log(`Preview: ${content2.slice(0, 200)}...\n`);

// ── Summary ──────────────────────────────────────────────────────────
const totalPrompt = (resp0.usage?.prompt_tokens ?? 0) + (resp1.usage?.prompt_tokens ?? 0) + (resp2.usage?.prompt_tokens ?? 0);
const totalCompletion = (resp0.usage?.completion_tokens ?? 0) + (resp1.usage?.completion_tokens ?? 0) + (resp2.usage?.completion_tokens ?? 0);
console.log('=== Pipeline Summary ===');
console.log(`Step 0 output: ${content0.length} chars`);
console.log(`Step 1 output: ${content1.length} chars`);
console.log(`Step 2 output: ${content2.length} chars`);
console.log(`Total tokens: prompt=${totalPrompt} completion=${totalCompletion} total=${totalPrompt + totalCompletion}`);
console.log('\nFull 3-step pipeline completed.');
