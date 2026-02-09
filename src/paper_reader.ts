// src/paper_reader.ts — PaperReader class extending BasicLLM

import { BasicLLM } from './basic_llm.ts';
import type { BasicLLMConfig } from './basic_llm.ts';
import type { ChatCompletion } from 'openai/resources/chat/completions';

// ── Types ────────────────────────────────────────────────────────────

export interface PaperReaderInput {
  response: string[];
  markdown: string;
}

// ── Template Formatting ──────────────────────────────────────────────

/**
 * Replace Python-style placeholders in a prompt template:
 *   {paper_md}    → input.markdown
 *   {response[0]} → input.response[0]
 *   {response[1]} → input.response[1]
 *   ... etc.
 */
export function formatTemplate(template: string, input: PaperReaderInput): string {
  let result: string = template;
  // Replace {paper_md}
  result = result.replace(/\{paper_md\}/g, input.markdown);
  // Replace {response[N]} for each index
  result = result.replace(/\{response\[(\d+)\]\}/g, (_match: string, index: string) => {
    const i: number = parseInt(index, 10);
    return input.response[i] ?? '';
  });
  return result;
}

// ── Class ────────────────────────────────────────────────────────────

export class PaperReader extends BasicLLM {
  constructor(config: BasicLLMConfig) {
    super(config);
  }

  async call(userInput: PaperReaderInput | string): Promise<ChatCompletion> {
    let userContent: string;

    if (typeof userInput === 'string') {
      // Freeform mode: no template, just pass the string directly
      userContent = userInput;
    } else {
      // Structured mode: format the prompt template with the input dict
      if (!this.promptTemplate) {
        // No template — just pass the markdown as the user message
        userContent = userInput.markdown;
      } else {
        userContent = formatTemplate(this.promptTemplate, userInput);
      }
    }

    // Bypass parent's template formatting — send directly to LLM
    return this.sendToLLM(userContent);
  }
}
