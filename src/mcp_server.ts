import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { paperContent } from "./tools/markdown.js";
import { acdSearch, dfsSearch } from "./tools/academic.js";
import { webSearch, webContent } from "./tools/web.js";

const server = new McpServer({
  name: "neocortica",
  version: "0.2.0",
});

// ── Helper: build progress callback from MCP extra ──────────────────

function makeProgress(server: McpServer, extra: any) {
  const token = extra?._meta?.progressToken;
  return async (info: { message: string; current?: number; total?: number }) => {
    if (token !== undefined && info.current !== undefined && info.total !== undefined) {
      await extra.sendNotification({
        method: "notifications/progress",
        params: { progressToken: token, progress: info.current, total: info.total, message: info.message },
      });
    }
    try { await server.sendLoggingMessage({ level: "info", data: info.message }); } catch {}
  };
}

// ── Tools ───────────────────────────────────────────────────────────

server.tool(
  "paper_content",
  "Convert a paper to markdown. Accepts a title, arXiv URL, PDF URL, or local PDF path. " +
  "Returns paper metadata with cached markdown path.",
  {
    title: z.string().optional().describe("Paper title"),
    url: z.string().optional().describe("arXiv URL or PDF URL"),
    dir: z.string().optional().describe("Local PDF file path"),
  },
  async (args, extra: any) => {
    try {
      const result = await paperContent(args, makeProgress(server, extra));
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text" as const, text: `paper_content failed: ${e.message}` }] };
    }
  },
);

server.tool(
  "acd_search",
  "Academic search: query Google Scholar, fetch full text for each result, " +
  "cache markdown locally. Returns paper metadata list.",
  {
    query: z.string().describe("Search query for Google Scholar"),
  },
  async ({ query }, extra: any) => {
    try {
      const results = await acdSearch(query, makeProgress(server, extra));
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text" as const, text: `acd_search failed: ${e.message}` }] };
    }
  },
);

server.tool(
  "dfs_search",
  "Deep reference exploration via DFS. Follows references of a paper " +
  "recursively up to depth/breadth limits. Returns all discovered papers.",
  {
    title: z.string().describe("Paper title"),
    normalizedTitle: z.string().describe("Normalized title for dedup"),
    s2Id: z.string().optional().describe("Semantic Scholar paper ID"),
    depth: z.number().describe("Max recursion depth"),
    breadth: z.number().describe("Max references per level"),
    visited: z.array(z.string()).optional().describe("Already visited normalizedTitles"),
  },
  async (args, extra: any) => {
    try {
      const paper = {
        title: args.title,
        normalizedTitle: args.normalizedTitle,
        s2Id: args.s2Id,
      };
      const results = await dfsSearch(
        paper,
        args.depth,
        args.breadth,
        args.visited ?? [],
        makeProgress(server, extra),
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text" as const, text: `dfs_search failed: ${e.message}` }] };
    }
  },
);

server.tool(
  "web_search",
  "Search the web via Brave Search. Returns a list of results with title, URL, and description. " +
  "Use web_content to fetch full markdown for specific URLs.",
  {
    query: z.string().describe("Search query"),
    count: z.number().optional().describe("Max results (default 10)"),
  },
  async (args) => {
    try {
      const results = await webSearch(args.query, args.count);
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text" as const, text: `web_search failed: ${e.message}` }] };
    }
  },
);

server.tool(
  "web_content",
  "Fetch a web page and convert it to markdown. Caches the result locally. " +
  "Returns metadata with cached markdown path.",
  {
    url: z.string().describe("URL to fetch"),
    title: z.string().optional().describe("Page title (derived from URL if omitted)"),
  },
  async (args) => {
    try {
      const result = await webContent(args.url, args.title);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text" as const, text: `web_content failed: ${e.message}` }] };
    }
  },
);

// ── Start ───────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
