# PaperReader

Extends `BasicLLM` for reading and analyzing arXiv papers. Supports a 3-step structured reading pipeline and freeform mode.

## Import

```typescript
import { PaperReader } from './src/paper_reader.ts';
import type { PaperReaderInput } from './src/paper_reader.ts';
import { paperReadingSystem, paperReading00, paperReading01, paperReading02 } from './prompt/paper_reading.ts';
import { loadPaper } from './src/arxiv.ts';
```

## PaperReaderInput

```typescript
interface PaperReaderInput {
  response: string[];  // outputs from previous steps (empty for step 0)
  markdown: string;    // the full paper markdown
}
```

## 3-Step Pipeline (Structured Mode)

The standard workflow: Quick Scan → Deep Dive → Critical Thinking.

```typescript
// Load a paper (from cache or network)
const markdown: string = await loadPaper('2508.10925');

// Shared config
const baseConfig = {
  baseUrl:      process.env['BASE_URL_OPENROUTER']!,
  apiKey:       process.env['API_KEY_OPENROUTER']!,
  modelName:    'openai/gpt-oss-120b',
  systemPrompt: paperReadingSystem,
};

// Step 0: Quick Scan
const reader0 = new PaperReader({ ...baseConfig, promptTemplate: paperReading00 });
const resp0 = await reader0.call({ response: [], markdown });
const content0: string = resp0.choices[0]?.message.content ?? '';

// Step 1: Deep Dive (receives step 0 output)
const reader1 = new PaperReader({ ...baseConfig, promptTemplate: paperReading01 });
const resp1 = await reader1.call({ response: [content0], markdown });
const content1: string = resp1.choices[0]?.message.content ?? '';

// Step 2: Critical Thinking (receives step 0 + step 1 outputs)
const reader2 = new PaperReader({ ...baseConfig, promptTemplate: paperReading02 });
const resp2 = await reader2.call({ response: [content0, content1], markdown });
const content2: string = resp2.choices[0]?.message.content ?? '';
```

### How Steps Chain Together

| Step | Template | `response[]` receives | Template placeholders used |
| --- | --- | --- | --- |
| 0 | `paperReading00` | `[]` (empty) | `{paper_md}` |
| 1 | `paperReading01` | `[step0_output]` | `{response[0]}`, `{paper_md}` |
| 2 | `paperReading02` | `[step0_output, step1_output]` | `{response[0]}`, `{response[1]}`, `{paper_md}` |

Not all steps are required. You can run only step 0, or steps 0+1, depending on the depth of analysis needed.

## Partial Pipeline (Single Step)

Run only the Quick Scan:

```typescript
const reader = new PaperReader({
  baseUrl:        process.env['BASE_URL_OPENROUTER']!,
  apiKey:         process.env['API_KEY_OPENROUTER']!,
  modelName:      'openai/gpt-oss-120b',
  systemPrompt:   paperReadingSystem,
  promptTemplate: paperReading00,
});

const markdown: string = await loadPaper('GPT-4 Technical Report');
const resp = await reader.call({ response: [], markdown });
console.log(resp.choices[0]?.message.content);
```

## Freeform Mode (No Template)

Pass a plain string instead of `PaperReaderInput`. Useful for custom questions about a paper:

```typescript
const reader = new PaperReader({
  baseUrl:      process.env['BASE_URL_OPENROUTER']!,
  apiKey:       process.env['API_KEY_OPENROUTER']!,
  modelName:    'openai/gpt-oss-120b',
  systemPrompt: paperReadingSystem,
  // no promptTemplate
});

const markdown: string = await loadPaper('2303.08774');
const resp = await reader.call(`Summarize the key contributions of this paper:\n\n${markdown}`);
console.log(resp.choices[0]?.message.content);
```

## APIFY Integration

When papers come from APIFY with both `title` and `link`:

```typescript
const apifyItem = {
  title: 'gpt-oss-120b & gpt-oss-20b model card',
  link: 'https://arxiv.org/abs/2508.10925',
};

// Load paper using APIFY data
const markdown: string = await loadPaper(apifyItem.link, apifyItem.title);

// Run analysis
const reader0 = new PaperReader({ ...baseConfig, promptTemplate: paperReading00 });
const resp = await reader0.call({ response: [], markdown });
```

## Prompt Templates

Located in `prompt/`:

| File | Step | Description |
| --- | --- | --- |
| `paper_reading_system.md` | system | Expert paper analyst role and guidelines |
| `paper_reading_00.md` | 0 | Quick Scan — topic, structure, contributions, keywords, value |
| `paper_reading_01.md` | 1 | Deep Dive — introduction, methodology, results, discussion, conclusion |
| `paper_reading_02.md` | 2 | Critical Thinking — methodology critique, credibility, innovation, logic |

## Token Usage Reference

Tested with gpt-oss model card (71k chars) on `openai/gpt-oss-120b`:

| Step | Prompt Tokens | Completion Tokens | Total |
| --- | --- | --- | --- |
| 0 | 18,582 | 3,246 | 21,828 |
| 1 | 21,699 | 6,521 | 28,220 |
| 2 | 28,253 | 3,712 | 31,965 |
| **Total** | **68,534** | **13,479** | **82,013** |
