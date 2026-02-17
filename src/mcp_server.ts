// src/mcp_server.ts — MCP server that forwards to NEOCORTICA_RAILWAY

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { pdfMarkdown } from './pdf_utils.ts';

// ── Config ───────────────────────────────────────────────────────────

const BACKEND_URL = process.env['BASE_URL_NEOCORTICA'] ?? 'http://localhost:3000';
const API_SECRET  = process.env['API_KEY_NEOCORTICA']  ?? '';

// ── HTTP helper ──────────────────────────────────────────────────────

async function apiCall<T>(
  method: 'GET' | 'POST',
  path: string,
  params?: Record<string, string>,
  body?: unknown,
): Promise<T> {
  let url = `${BACKEND_URL}/api${path}`;
  if (params) {
    const qs = new URLSearchParams(params);
    url += '?' + qs.toString();
  }
  const resp = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_SECRET}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`backend ${resp.status}: ${text}`);
  }
  return resp.json() as Promise<T>;
}

// ── MCP Server ───────────────────────────────────────────────────────

const server = new McpServer({
  name: 'neocortica',
  version: '0.1.0',
});

// paper_searching — fetch raw markdown
server.tool(
  'paper_searching',
  'Fetch the full markdown text of an arXiv paper. Provide at least id, url, or title.',
  {
    id:    z.string().optional().describe('arXiv ID, e.g. "2205.14135"'),
    url:   z.string().optional().describe('arXiv URL, e.g. "https://arxiv.org/abs/2205.14135"'),
    title: z.string().optional().describe('Paper title, e.g. "Attention Is All You Need"'),
  },
  async (args) => {
    const params: Record<string, string> = {};
    if (args.id)    params['id']    = args.id;
    if (args.url)   params['url']   = args.url;
    if (args.title) params['title'] = args.title;

    const data = await apiCall<{ markdown: string }>(
      'GET', '/paper/search', params,
    );
    return { content: [{ type: 'text' as const, text: data.markdown }] };
  },
);

// paper_reading — AI analysis (arxiv or local PDF)
server.tool(
  'paper_reading',
  'Read a paper with AI analysis. Supports arXiv (id/url/title) or local PDF (path).',
  {
    id:     z.string().optional().describe('arXiv ID, e.g. "2205.14135"'),
    url:    z.string().optional().describe('arXiv URL, e.g. "https://arxiv.org/abs/2205.14135"'),
    title:  z.string().optional().describe('Paper title (optional)'),
    path:   z.string().optional().describe('Local PDF file path'),
    prompt: z.string().optional().describe('Custom reading prompt'),
  },
  async (args) => {
    const body: Record<string, string> = {};
    if (args.prompt) body['prompt'] = args.prompt;

    if (args.path) {
      // Local PDF → convert via Modal, send markdown to backend
      const md = await pdfMarkdown({ path: args.path });
      body['markdown'] = md;
    } else {
      if (args.id)    body['id']    = args.id;
      if (args.url)   body['url']   = args.url;
      if (args.title) body['title'] = args.title;
    }

    const data = await apiCall<{ response: string }>(
      'POST', '/paper/read', undefined, body,
    );
    return { content: [{ type: 'text' as const, text: data.response }] };
  },
);

// ── Start ────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
