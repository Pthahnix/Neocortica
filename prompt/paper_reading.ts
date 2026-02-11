// prompt/paper_reading.ts — load paper reading prompts from markdown files

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const PROMPT_DIR: string = dirname(fileURLToPath(import.meta.url));

export const paperReadingSystem: string = readFileSync(join(PROMPT_DIR, 'paper_reading_system.md'), 'utf-8');
