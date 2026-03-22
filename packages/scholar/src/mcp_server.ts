import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { paperSearching } from "./tools/paper_searching.js";
import { paperFetching } from "./tools/paper_fetching.js";
import { paperContent } from "./tools/paper_content.js";
import { paperReference } from "./tools/paper_reference.js";
import { paperReading } from "./tools/paper_reading.js";
import type { ProgressCallback } from "./utils/pdf.js";

const server = new McpServer({
  name: "neocortica-scholar",
  version: "0.2.0",
});

// ── Helper ───────────────────────────────────────────────────────

function makeProgress(extra: any): ProgressCallback {
  const token = extra?._meta?.progressToken;
  return async (info) => {
    if (token !== undefined && info.current !== undefined && info.total !== undefined) {
      await extra.sendNotification({
        method: "notifications/progress",
        params: { progressToken: token, progress: info.current, total: info.total, message: info.message },
      });
    }
    try { await server.sendLoggingMessage({ level: "info", data: info.message }); } catch {}
  };
}

// ── Tool 1: paper_searching ─────────────────────────────────────

server.tool(
  "paper_searching",
  "Enrich a raw Google Scholar result with metadata from arXiv, Semantic Scholar, and Unpaywall. " +
  "Input: single item from apify google_scholar_scraper. Output: PaperMeta with abstract, arxivUrl, oaPdfUrl.",
  {
    title: z.string().optional().describe("Paper title"),
    link: z.string().optional().describe("Source URL from Scholar"),
    authors: z.string().optional().describe("Author string"),
    year: z.union([z.string(), z.number()]).optional().describe("Publication year"),
    citations: z.union([z.string(), z.number()]).optional().describe("Citation count"),
    searchMatch: z.string().optional().describe("Snippet / abstract from Scholar"),
    documentLink: z.string().optional().describe("Direct PDF link from Scholar"),
  },
  async (args) => {
    try {
      const result = await paperSearching(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text" as const, text: `paper_searching failed: ${e.message}` }] };
    }
  },
);

// ── Tool 2: paper_fetching ──────────────────────────────────────

server.tool(
  "paper_fetching",
  "Fetch full paper as markdown. Cache-first. " +
  "Tries arxiv2md for arxivUrl, MinerU for oaPdfUrl. When pdfPath is set, title is auto-derived from filename. " +
  "Returns PaperMeta with markdownPath.",
  {
    title: z.string().optional().describe("Paper title"),
    normalizedTitle: z.string().optional().describe("Normalized title for cache lookup"),
    arxivId: z.string().optional(),
    doi: z.string().optional(),
    s2Id: z.string().optional(),
    abstract: z.string().optional(),
    arxivUrl: z.string().optional().describe("arXiv abs URL"),
    oaPdfUrl: z.string().optional().describe("Open access PDF URL"),
    pdfPath: z.string().optional().describe("Absolute local path to a PDF file"),
    year: z.number().optional(),
    authors: z.string().optional(),
    citationCount: z.number().optional(),
    sourceUrl: z.string().optional(),
  },
  async (args, extra: any) => {
    try {
      const meta = { ...args, title: args.title ?? "", normalizedTitle: args.normalizedTitle ?? "" };
      const result = await paperFetching(meta, makeProgress(extra));
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text" as const, text: `paper_fetching failed: ${e.message}` }] };
    }
  },
);

// ── Tool 3: paper_content ───────────────────────────────────────

server.tool(
  "paper_content",
  "Read cached paper markdown content by title. Returns full markdown string. Pure local, no network.",
  {
    title: z.string().optional().describe("Paper title"),
    normalizedTitle: z.string().optional().describe("Normalized title for cache lookup"),
  },
  async (args) => {
    try {
      const result = paperContent(args);
      if (!result) {
        return { content: [{ type: "text" as const, text: "Paper not found in cache." }] };
      }
      return { content: [{ type: "text" as const, text: result.content }] };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text" as const, text: `paper_content failed: ${e.message}` }] };
    }
  },
);

// ── Tool 4: paper_reference ─────────────────────────────────────

server.tool(
  "paper_reference",
  "Get all references of a paper. Uses Semantic Scholar API (by s2Id, arxivId, or DOI), " +
  "falls back to markdown parsing if no identifiers available. Returns PaperMeta[] for all references.",
  {
    title: z.string().describe("Paper title"),
    normalizedTitle: z.string().describe("Normalized title"),
    s2Id: z.string().optional().describe("Semantic Scholar paper ID"),
    arxivId: z.string().optional().describe("arXiv paper ID"),
    doi: z.string().optional().describe("DOI"),
    markdownPath: z.string().optional().describe("Path to cached markdown (for fallback parsing)"),
  },
  async (args) => {
    try {
      const results = await paperReference(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text" as const, text: `paper_reference failed: ${e.message}` }] };
    }
  },
);

// ── Tool 5: paper_reading ───────────────────────────────────────

server.tool(
  "paper_reading",
  "AI-powered paper reader using three-pass Keshav method. Reads paper markdown via LLM agent and returns structured report. " +
  "Supports batch processing with configurable concurrency.",
  {
    papers: z.array(z.object({
      markdownPath: z.string().describe("Absolute path to paper markdown"),
      title: z.string().optional().describe("Paper title"),
    })).describe("Papers to read"),
    prompt: z.string().optional().describe("Custom reading prompt (default: three-pass Keshav method)"),
    batchSize: z.number().optional().describe("Papers per agent (default: 1)"),
    concurrency: z.number().optional().describe("Parallel agents (default: 1)"),
  },
  async (args) => {
    try {
      const results = await paperReading(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text" as const, text: `paper_reading failed: ${e.message}` }] };
    }
  },
);

// ── Start ───────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
