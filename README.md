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

Multi-MCP architecture: research skills orchestrate external MCP servers for academic search, web search, and GPU execution. The Supervisor HTTP service handles remote experiment dispatch.

## Research Pipeline (v0.8.0)

Five-stage iterative pipeline: Topic → Literature Survey → Gap Analysis → Idea Generation → Experiment Design → Experiment Execution

Each stage (1–4) uses SEARCH→READ→REFLECT→EVALUATE cycles with autonomous gap discovery and dynamic stopping conditions. Stage 5 dispatches the experiment to a GPU pod via the Supervisor HTTP service.

**Key Features**:

- 6 parallel searches per iteration (3 google-scholar-scraper + 3 brave_web_search)
- Two-step enrich pipeline: paper_searching → paper_fetching
- Three-pass reading protocol (High/Medium/Low rating)
- State inheritance between stages (knowledge + papersRead)
- Zero external validation cost
- Dynamic stopping: gaps cleared, no progress for 3 rounds, or target reached
- Supervisor-mediated experiment execution: local CC → HTTP API → remote CC on RunPod pod
- Checkpoint-based phase control with continue/revise/abort feedback

## Prerequisites

### Required MCP Servers

Neocortica depends on the following external MCP servers. Install them before use:

| MCP Server | Package / Source | Purpose | API Key Required |
|---|---|---|---|
| **neocortica-scholar** | [Neocortica-Scholar](https://github.com/Pthahnix/Neocortica-Scholar) | Academic paper pipeline (search, fetch, read, references) | MinerU token, OpenAI-compatible API key |
| **apify** | `@apify/actors-mcp-server` (`npm install -g @apify/actors-mcp-server`) | Google Scholar search + web page scraping | [Apify API token](https://console.apify.com/account#/integrations) |
| **brave-search** | `@brave/brave-search-mcp-server` (`npm install -g @brave/brave-search-mcp-server`) | Web search API | [Brave Search API key](https://brave.com/search/api/) |
| **runpod** | `@runpod/mcp-server` (`npm install -g @runpod/mcp-server`) | GPU pod lifecycle (create/start/stop/delete) | [RunPod API key](https://www.runpod.io/console/user/settings) |
| **railway** | `@railway/mcp-server` (`npm install -g @railway/mcp-server`) | Deployment platform | [Railway API token](https://railway.app/account/tokens) |

### neocortica-scholar Setup

Clone and install the academic paper MCP server:

```bash
git clone https://github.com/Pthahnix/Neocortica-Scholar.git
cd Neocortica-Scholar
npm install
```

Required environment variables for neocortica-scholar (set in `.mcp.json`):

| Variable | Description | How to Get |
|---|---|---|
| `MINERU_TOKEN` | MinerU API token for PDF → markdown conversion | [MinerU](https://mineru.net/) |
| `EMAIL` | Email for Unpaywall API (polite pool) | Your email |
| `NEOCORTICA_CACHE` | Cache directory path | e.g., `.cache` |
| `OPENAI_API_KEY` | OpenAI-compatible API key (for AI paper reading) | [OpenRouter](https://openrouter.ai/) or any OpenAI-compatible provider |
| `OPENAI_BASE_URL` | API base URL | e.g., `https://openrouter.ai/api/v1` |
| `OPENAI_MODEL` | Model name for paper reading agent | e.g., `openai/gpt-oss-120b` |

## Quick Start

1. Install prerequisites above
2. Copy `.mcp.example.json` to `.mcp.json` and fill in your API keys and paths
3. Set up `.env`:

```bash
DIR_CACHE=.cache/
API_KEY_RUNPOD=your-runpod-key          # optional, for experiment execution
```

4. Claude Code will auto-discover all tools from the configured MCP servers.

## Tools

### neocortica-scholar (Academic Paper Pipeline)

| Tool | Description |
| ---- | ----------- |
| `paper_searching` | Enrich Google Scholar results into PaperMeta (arXiv, Semantic Scholar, Unpaywall) |
| `paper_fetching` | Fetch full paper as markdown (cache-first, multi-source fallback) |
| `paper_content` | Read cached paper markdown (local only, no network) |
| `paper_reference` | Get paper references via Semantic Scholar API |
| `paper_reading` | AI three-pass reading (Keshav method) via LLM agent |

### apify (Google Scholar + Web Scraping)

| Tool | Description |
| ---- | ----------- |
| `google-scholar-scraper` | Search Google Scholar for papers |
| `rag-web-browser` | Fetch web page as markdown |

### brave-search

| Tool | Description |
| ---- | ----------- |
| `brave_web_search` | Web search via Brave Search API |

### runpod

| Tool | Description |
| ---- | ----------- |
| `create-pod` / `start-pod` / `stop-pod` / `delete-pod` | GPU pod lifecycle management |

## Architecture

```
MCP Client (Claude Code — local)
    │
    ├── neocortica-scholar MCP ─── academic paper pipeline
    │       ├── paper_searching    → enrich Scholar results (arXiv, SS, Unpaywall)
    │       ├── paper_fetching     → fetch full text as markdown
    │       ├── paper_content      → read cached markdown
    │       ├── paper_reference    → Semantic Scholar references
    │       └── paper_reading      → AI three-pass reading
    │
    ├── @apify/actors-mcp-server ─── Google Scholar + web scraping
    │       ├── google-scholar-scraper → search Google Scholar
    │       └── rag-web-browser        → fetch web pages as markdown
    │
    ├── @brave/brave-search-mcp-server ─── web search
    │
    ├── @runpod/mcp-server ─── GPU pod lifecycle
    │
    └── Supervisor (src/supervisor/) ─── HTTP service on RunPod pod
            ├── POST /task ──→ write task file → spawn remote CC
            ├── GET  /task/:id/status ──→ poll execution state
            ├── GET  /task/:id/report ──→ fetch checkpoint reports
            ├── POST /task/:id/feedback ──→ continue/revise/abort
            └── GET  /task/:id/files/*path ──→ download results
```

## License

[Apache-2.0 License](LICENSE)
