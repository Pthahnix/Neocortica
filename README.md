# Neocortica

Vibe researching toolkit — AI-powered academic research automation, from literature discovery to experiment execution.

> [!NOTE]
> This is a work-in-progress personal project, under active development.

## What It Does

- Search and filter academic papers from Google Scholar
- Deep reference exploration via Semantic Scholar citation graphs
- Convert arXiv papers, PDFs, and web pages to AI-readable markdown
- Web search via Brave Search API for non-academic sources
- Full-text caching for offline access and repeated queries
- GPU experiment execution via RunPod with Supervisor HTTP service (pod provisioning, remote training, result retrieval)
- Five-stage research pipeline: survey → gaps → ideas → design → execution

## How It Works

Most academic AI tools only read abstracts to triage papers. Neocortica downloads the full paper text, converts it to markdown, and lets AI evaluate based on complete methodology, experiments, and discussion.

Three-layer architecture: atomic API wrappers (`utils/`) → pipeline orchestration (`tools/`) → MCP server registration (`mcp_server.ts`).

## Research Pipeline (v0.7.0)

Five-stage iterative pipeline: Topic → Literature Survey → Gap Analysis → Idea Generation → Experiment Design → Experiment Execution

Each stage (1–4) uses SEARCH→READ→REFLECT→EVALUATE cycles with autonomous gap discovery and dynamic stopping conditions. Stage 5 dispatches the experiment to a GPU pod via the Supervisor HTTP service.

**Key Features**:

- 6 parallel searches per iteration (3 acd_search + 3 web_search)
- Three-pass reading protocol (High/Medium/Low rating)
- State inheritance between stages (knowledge + papersRead)
- Zero external validation cost
- Dynamic stopping: gaps cleared, no progress for 3 rounds, or target reached
- Supervisor-mediated experiment execution: local CC → HTTP API → remote CC on RunPod pod
- Checkpoint-based phase control with continue/revise/abort feedback

## Quick Start

```bash
npm install
```

Set up `.env`:

```bash
DIR_CACHE=.cache/
TOKEN_MINERU=your-mineru-token
TOKEN_APIFY=your-apify-token
TOKEN_BRAVE=your-brave-token
EMAIL_UNPAYWALL=your-email
API_KEY_RUNPOD=your-runpod-key          # optional, for experiment execution
```

### MCP Server

```bash
npm run mcp
```

The `.mcp.json` config is included — Claude Code will auto-discover all tools.

## Tools

| Tool | Description |
| ---- | ----------- |
| `paper_content` | Convert a paper to markdown (arXiv URL, PDF, or title → smart routing) |
| `acd_search` | Academic search via Google Scholar → fetch full text → cache |
| `dfs_search` | Deep reference exploration via DFS (Semantic Scholar references) |
| `web_search` | Search the web via Brave Search API |
| `web_content` | Fetch a web page as markdown and cache it |

## Architecture

```bash
MCP Client (Claude Code — local)
    │
    ├── mcp_server.ts ─── tool registration (Neocortica tools)
    │       │
    │       ├── tools/markdown.ts   → paper_content
    │       ├── tools/academic.ts   → acd_search, dfs_search
    │       ├── tools/web.ts        → web_search, web_content
    │               │
    │               ├── utils/arxiv.ts      → arxiv2md.org, arXiv API
    │               ├── utils/ss.ts         → Semantic Scholar
    │               ├── utils/unpaywall.ts  → Unpaywall
    │               ├── utils/pdf.ts        → MinerU cloud API
    │               ├── utils/apify.ts      → Apify (Google Scholar)
    │               ├── utils/brave.ts      → Brave Search API
    │               ├── utils/web.ts        → Apify rag-web-browser
    │               └── utils/markdown.ts   → local file I/O
    │
    ├── @runpod/mcp-server ─── GPU pod lifecycle (create/start/stop/delete)
    │
    └── Supervisor (src/supervisor/) ─── HTTP service on RunPod pod
            │
            ├── POST /task ──→ write task file → spawn remote CC
            ├── GET  /task/:id/status ──→ poll execution state
            ├── GET  /task/:id/report ──→ fetch checkpoint reports
            ├── POST /task/:id/feedback ──→ continue/revise/abort
            └── GET  /task/:id/files/*path ──→ download results
```

## License

[Apache-2.0 License](LICENSE)
