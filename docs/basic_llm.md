# BasicLLM

A base class wrapping the OpenAI SDK for LLM calls. Works with any OpenAI-compatible API (OpenRouter, OpenAI, etc.).

## Import

```typescript
import { BasicLLM } from './src/basic_llm.ts';
import type { BasicLLMConfig } from './src/basic_llm.ts';
```

## Config

```typescript
interface BasicLLMConfig {
  baseUrl:         string;    // API base URL
  apiKey:          string;    // API key
  modelName:       string;    // model identifier
  systemPrompt?:   string;    // optional system message
  promptTemplate?: string;    // optional template with {userInput} placeholder
}
```

## Usage

### Simple call

```typescript
const llm = new BasicLLM({
  baseUrl:   process.env['BASE_URL_OPENROUTER']!,
  apiKey:    process.env['API_KEY_OPENROUTER']!,
  modelName: 'openai/gpt-oss-120b',
});

const response = await llm.call('What is 2 + 3?');
console.log(response.choices[0]?.message.content);  // "5"
```

### With system prompt

```typescript
const llm = new BasicLLM({
  baseUrl:      process.env['BASE_URL_OPENROUTER']!,
  apiKey:       process.env['API_KEY_OPENROUTER']!,
  modelName:    'openai/gpt-oss-120b',
  systemPrompt: 'You are a helpful assistant that responds in JSON format.',
});

const response = await llm.call('List 3 colors.');
```

### With prompt template

Use `{userInput}` as the placeholder in the template:

```typescript
const llm = new BasicLLM({
  baseUrl:        process.env['BASE_URL_OPENROUTER']!,
  apiKey:         process.env['API_KEY_OPENROUTER']!,
  modelName:      'openai/gpt-oss-120b',
  promptTemplate: 'Translate the following to French:\n\n{userInput}',
});

const response = await llm.call('Hello, how are you?');
// LLM receives: "Translate the following to French:\n\nHello, how are you?"
```

## Return Value

Returns the full `ChatCompletion` object from the OpenAI SDK:

```typescript
const response = await llm.call('...');

// Response content
response.choices[0]?.message.content;

// Token usage
response.usage?.prompt_tokens;
response.usage?.completion_tokens;
response.usage?.total_tokens;

// Model info
response.model;
```

## Environment Variables

Required in `.env`:

```ini
BASE_URL_OPENROUTER = https://openrouter.ai/api/v1
API_KEY_OPENROUTER  = sk-or-v1-...
```
