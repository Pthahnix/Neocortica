import { PaperReader } from '../src/paper_reader.ts';
import { paperReadingSystem, paperReading00 } from '../prompt/paper_reading.ts';
import { loadPaper } from '../src/arxiv.ts';

// Load a cached paper (gpt-oss)
const markdown: string = await loadPaper('2508.10925');

// Create PaperReader for step 0 (Quick Scan)
const reader0 = new PaperReader({
  baseUrl:        process.env['BASE_URL_OPENROUTER']!,
  apiKey:         process.env['API_KEY_OPENROUTER']!,
  modelName:      'openai/gpt-oss-120b',
  systemPrompt:   paperReadingSystem,
  promptTemplate: paperReading00,
});

console.log('=== PaperReader Step 0: Quick Scan ===');
console.log('Paper length:', markdown.length, 'chars');
console.log('Calling LLM...\n');

const response = await reader0.call({ response: [], markdown });
const content: string = response.choices[0]?.message.content ?? '';

console.log('--- Response (first 1000 chars) ---');
console.log(content.slice(0, 1000));
console.log('...');
console.log('\n--- Stats ---');
console.log('Response length:', content.length, 'chars');
console.log('Model:', response.model);

if (response.usage) {
  console.log('Token usage:');
  console.log('  prompt:', response.usage.prompt_tokens);
  console.log('  completion:', response.usage.completion_tokens);
  console.log('  total:', response.usage.total_tokens);
}

console.log('\nStep 0 test passed.');
