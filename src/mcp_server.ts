// src/mcp_server.ts — MCP server that forwards to NEOCORTICA_RAILWAY

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

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

// ── Schema ───────────────────────────────────────────────────────────

const PaperArgs = {
  id:    z.string().optional().describe('arXiv ID, e.g. "2205.14135"'),
  url:   z.string().optional().describe('arXiv URL, e.g. "https://arxiv.org/abs/2205.14135"'),
  title: z.string().optional().describe('Paper title (optional)'),
};

// ── MCP Server ───────────────────────────────────────────────────────

const server = new McpServer({
  name: 'neocortica',
  version: '0.1.0',
});

// paper_searching — fetch raw markdown
server.tool(
  'paper_searching',
  'Fetch the full markdown text of an arXiv paper',
  PaperArgs,
  async (args) => {
    const params: Record<string, string> = {};
    if (args.id)  params['id']  = args.id;
    if (args.url) params['url'] = args.url;

    const data = await apiCall<{ title: string; markdown: string }>(
      'GET', '/paper/search', params,
    );
    return { content: [{ type: 'text' as const, text: data.markdown }] };
  },
);

// paper_reading — AI analysis
server.tool(
  'paper_reading',
  'Read an arXiv paper with AI and return structured analysis. Optionally provide a custom prompt.',
  { ...PaperArgs, prompt: z.string().optional().describe('Custom reading prompt') },
  async (args) => {
    const body: Record<string, string> = {};
    if (args.id)     body['id']     = args.id;
    if (args.url)    body['url']    = args.url;
    if (args.prompt) body['prompt'] = args.prompt;

    const data = await apiCall<{ title: string; response: string; status?: string; message?: string }>(
      'POST', '/paper/read', undefined, body,
    );

    // Handle 202 "fetching" response
    if (data.status === 'fetching') {
      return { content: [{ type: 'text' as const, text: `[${data.title}] ${data.message}` }] };
    }

    return { content: [{ type: 'text' as const, text: data.response }] };
  },
);

// ── Start ────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
