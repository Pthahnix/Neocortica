// src/mcp_server.ts — NEOCORTICA MCP Server

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { PaperSearcher } from './arxiv.ts';
import { PaperReader } from './paper_reader.ts';
import {
  paperReadingSystem,
  paperReading00,
  paperReading01,
  paperReading02,
} from '../prompt/paper_reading.ts';

// ── Redirect console.log to stderr (stdio transport uses stdout) ────

const _origLog = console.log;
console.log = console.error;

// ── Shared instances ────────────────────────────────────────────────

const searcher = new PaperSearcher();

function makeReader(systemPrompt: string, promptTemplate?: string) {
  return new PaperReader({
    baseUrl:   process.env['BASE_URL_OPENROUTER']!,
    apiKey:    process.env['API_KEY_OPENROUTER']!,
    modelName: process.env['MODEL_NAME']!,
    systemPrompt,
    promptTemplate,
  });
}

// ── Helpers ─────────────────────────────────────────────────────────

async function resolvePaper(args: { id?: string; url?: string; title?: string }) {
  const ctx = {
    paperTitle: args.title ?? '',
    paperId:    args.id ?? '',
    paperUrl:   args.url ?? '',
  };

  // Resolve ID
  ctx.paperId = searcher.paperId(ctx);
  // Resolve title (may need API call)
  ctx.paperTitle = await searcher.paperTitle(ctx);
  // Resolve URL
  ctx.paperUrl = searcher.paperUrl(ctx);
  // Resolve file path
  const paperFile = searcher.paperFile(ctx);

  return { ...ctx, paperFile };
}

// ── Server ──────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'neocortica',
  version: '1.0.0',
});

// ── Tool: paper_searching ───────────────────────────────────────────

server.tool(
  'paper_searching',
  'Fetch the full markdown text of an arXiv paper. Provide at least id or url.',
  {
    id:    z.string().optional().describe('arXiv ID, e.g. "2205.14135"'),
    url:   z.string().optional().describe('arXiv URL, e.g. "https://arxiv.org/abs/2205.14135"'),
    title: z.string().optional().describe('Paper title (optional, used for filename)'),
  },
  async (args) => {
    const ctx = await resolvePaper(args);
    const markdown = await searcher.paperMd(ctx);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          title:    ctx.paperTitle,
          url:      ctx.paperUrl,
          markdown,
        }),
      }],
    };
  },
);

// ── Tool: paper_reading ─────────────────────────────────────────────

server.tool(
  'paper_reading',
  'Read an arXiv paper with AI and return structured analysis (3-step: Quick Scan → Deep Dive → Critical Thinking). Optionally provide a custom prompt for freeform reading.',
  {
    id:     z.string().optional().describe('arXiv ID, e.g. "2205.14135"'),
    url:    z.string().optional().describe('arXiv URL, e.g. "https://arxiv.org/abs/2205.14135"'),
    title:  z.string().optional().describe('Paper title (optional)'),
    prompt: z.string().optional().describe('Custom reading prompt. If provided, skips the 3-step pipeline and uses this prompt directly.'),
  },
  async (args) => {
    const ctx = await resolvePaper(args);
    const markdown = await searcher.paperMd(ctx);

    let response: string;

    if (args.prompt) {
      // Freeform mode
      const reader = makeReader(paperReadingSystem);
      const input = `${args.prompt}\n\nPaper Text:\n\n\`\`\`markdown\n${markdown}\n\`\`\``;
      const completion = await reader.call(input);
      response = completion.choices[0]?.message?.content ?? '';
    } else {
      // 3-step structured pipeline
      const templates = [paperReading00, paperReading01, paperReading02];
      const responses: string[] = [];

      for (const tmpl of templates) {
        const reader = makeReader(paperReadingSystem, tmpl);
        const input = { response: responses, markdown };
        const completion = await reader.call(input);
        const text = completion.choices[0]?.message?.content ?? '';
        responses.push(text);
      }

      response = [
        '## Step 1: Quick Scan\n\n' + responses[0],
        '## Step 2: Deep Dive\n\n' + responses[1],
        '## Step 3: Critical Thinking\n\n' + responses[2],
      ].join('\n\n---\n\n');
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          title:    ctx.paperTitle,
          url:      ctx.paperUrl,
          response,
        }),
      }],
    };
  },
);

// ── Start ───────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
server.connect(transport);
