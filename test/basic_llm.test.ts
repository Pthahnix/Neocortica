import { BasicLLM } from '../src/basic_llm.ts';

const llm = new BasicLLM({
  baseUrl:   process.env['BASE_URL_OPENROUTER']!,
  apiKey:    process.env['API_KEY_OPENROUTER']!,
  modelName: 'openai/gpt-oss-120b',
});

console.log('=== BasicLLM test: simple call ===');
const response = await llm.call('What is 2 + 3? Answer with just the number.');
const content = response.choices[0]?.message.content;
console.log('Response:', content);
console.log('Model:', response.model);

if (response.usage) {
  console.log('Token usage:');
  console.log('  prompt:', response.usage.prompt_tokens);
  console.log('  completion:', response.usage.completion_tokens);
  console.log('  total:', response.usage.total_tokens);
}

console.log('\n=== BasicLLM test: with systemPrompt ===');
const llm2 = new BasicLLM({
  baseUrl:      process.env['BASE_URL_OPENROUTER']!,
  apiKey:       process.env['API_KEY_OPENROUTER']!,
  modelName:    'openai/gpt-oss-120b',
  systemPrompt: 'You are a pirate. Always respond in pirate speak.',
});

const response2 = await llm2.call('What is the weather like?');
console.log('Response:', response2.choices[0]?.message.content?.slice(0, 200));

console.log('\nAll BasicLLM tests passed.');
