// src/paper_reader.ts — PaperReader class extending BasicLLM

import { BasicLLM } from './basic_llm.js';
import type { BasicLLMConfig } from './basic_llm.js';

// ── Class ────────────────────────────────────────────────────────────

export class PaperReader extends BasicLLM {
  constructor(config: BasicLLMConfig) {
    super(config);
  }
}
