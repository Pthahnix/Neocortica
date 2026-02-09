// src/basic_llm.ts — BasicLLM base class

import 'dotenv/config';
import { OpenAI } from 'openai';
import type { ChatCompletion, ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// ── Types ────────────────────────────────────────────────────────────

export interface BasicLLMConfig {
  baseUrl:         string;
  apiKey:          string;
  modelName:       string;
  systemPrompt?:   string;
  promptTemplate?: string;
}

// ── Class ────────────────────────────────────────────────────────────

export class BasicLLM {
  protected client:         OpenAI;
  protected modelName:      string;
  protected systemPrompt:   string | null;
  protected promptTemplate: string | null;

  constructor(config: BasicLLMConfig) {
    this.client         = new OpenAI({ baseURL: config.baseUrl, apiKey: config.apiKey });
    this.modelName      = config.modelName;
    this.systemPrompt   = config.systemPrompt   ?? null;
    this.promptTemplate = config.promptTemplate ?? null;
  }

  async call(userInput: string): Promise<ChatCompletion> {
    // Format user content: apply prompt template if present
    const userContent: string = this.promptTemplate
      ? this.promptTemplate.replace('{userInput}', userInput)
      : userInput;

    return this.sendToLLM(userContent);
  }

  /** Send pre-formatted content directly to the LLM (no template applied). */
  protected async sendToLLM(userContent: string): Promise<ChatCompletion> {
    // Build messages array
    const messages: ChatCompletionMessageParam[] = [];
    if (this.systemPrompt) {
      messages.push({ role: 'system', content: this.systemPrompt });
    }
    messages.push({ role: 'user', content: userContent });

    // Call LLM
    const completion: ChatCompletion = await this.client.chat.completions.create({
      model:    this.modelName,
      messages: messages,
    });

    return completion;
  }
}
