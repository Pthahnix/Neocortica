import { loadPaper } from './src/arxiv.ts';
import { BasicLLM } from './src/basic_llm.ts';

// ── Step 1: Load paper markdown ─────────────────────────────────────
const markdown: string = await loadPaper('2406.14491');
console.log(`Paper loaded: ${markdown.length} chars\n`);

// ── Step 2: Send to BasicLLM for reading ────────────────────────────
const llm = new BasicLLM({
  baseUrl:   process.env['BASE_URL_OPENROUTER']!,
  apiKey:    process.env['API_KEY_OPENROUTER']!,
  modelName: 'openai/gpt-oss-120b',
  systemPrompt: 'You are a helpful assistant. Read the paper provided by the user and give a concise summary.',
});

console.log('Sending markdown to LLM...\n');
const completion = await llm.call(markdown);

const content = completion.choices[0]?.message?.content ?? '(no content)';
console.log('=== LLM Response ===\n');
console.log(content);
console.log('\n=== Token Usage ===');
console.log(`  prompt:     ${completion.usage?.prompt_tokens}`);
console.log(`  completion: ${completion.usage?.completion_tokens}`);
console.log(`  total:      ${completion.usage?.total_tokens}`);

// npx tsx test.ts
