// src/mcp_server.ts — NEOCORTICA MCP Client (HTTP forwarding)

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ── Redirect console.log to stderr (stdio transport uses stdout) ────

console.log = console.error;

// ── Config ──────────────────────────────────────────────────────────

const API_URL = process.env['NEOCORTICA_API_URL'];
const API_KEY = process.env['NEOCORTICA_API_KEY'];

if (!API_URL) {
  console.error('NEOCORTICA_API_URL is required');
  process.exit(1);
}

// ── HTTP helper ─────────────────────────────────────────────────────

async function apiCall(endpoint: string, body: object): Promise<unknown> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) headers['X-API-Key'] = API_KEY;

  const resp = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  if (!resp.ok) {
    const msg = (data as { error?: string }).error ?? `API error ${resp.status}`;
    throw new Error(msg);
  }
  return data;
}

// ── Server ──────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'neocortica',
  version: '2.0.0',
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
    const data = await apiCall('/api/paper/search', args);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(data) }],
    };
  },
);

// ── Tool: paper_reading ─────────────────────────────────────────────

server.tool(
  'paper_reading',
  'Read an arXiv paper with AI and return structured analysis. Optionally provide a custom prompt for freeform reading.',
  {
    id:     z.string().optional().describe('arXiv ID, e.g. "2205.14135"'),
    url:    z.string().optional().describe('arXiv URL, e.g. "https://arxiv.org/abs/2205.14135"'),
    title:  z.string().optional().describe('Paper title (optional)'),
    prompt: z.string().optional().describe('Custom reading prompt. If provided, skips the 3-step pipeline and uses this prompt directly.'),
  },
  async (args) => {
    const data = await apiCall('/api/paper/read', args);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(data) }],
    };
  },
);

// ── Start ───────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
server.connect(transport);
