# Neocortica v2.0.0

Vibe researching toolkit — AI-powered academic research automation, from literature discovery to experiment execution.

> [!NOTE]
> This is a work-in-progress personal project, under active development.

## What It Does

- Search and filter academic papers from Google Scholar
- Deep reference exploration via Semantic Scholar citation graphs
- Convert arXiv papers, PDFs, and web pages to AI-readable markdown
- Web search via Brave Search API for non-academic sources
- Full-text caching for offline access and repeated queries
- Review-driven quality loop: independent CC process reviews research outputs, scores each stage, and selectively re-runs stages until quality threshold is met
- GPU experiment execution on remote pods via Git-based context transfer (push research context to GitHub, clone on pod)
- Dual pod target support: RunPod GPU pods and remote SSH servers
- Five-stage research pipeline: survey → gaps → ideas → review loop → design → execution

## How It Works

Most academic AI tools only read abstracts to triage papers. Neocortica downloads the full paper text, converts it to markdown, and lets AI evaluate based on complete methodology, experiments, and discussion.

Multi-MCP monorepo architecture: research skills orchestrate MCP servers (packaged as workspace modules) for academic search, web search, and GPU execution. Stages 1-3 (survey, gap, idea) run in a review loop — after each pass, a separate Claude Code process (`claude -p`) independently reviews the outputs with web search verification, then selectively triggers re-runs of weak stages. Stage 5 uses Git-based context transfer to deploy full research context to remote GPU pods.

## Monorepo Structure

v2.0.0 consolidates all MCP servers into a single npm workspaces monorepo:

```
neocortica/
├── packages/
│   ├── scholar/          # Academic paper MCP (search, fetch, read, references)
│   ├── web/              # Web page MCP (fetch, cache)
│   └── session/          # Git-based context transfer (scripts for pod provisioning)
├── skill/                # Research workflow SOPs
├── pipeline/             # Fixed tool-orchestration workflows
├── prompt/               # LLM prompt templates
├── package.json          # Root workspace config
└── .mcp.json             # MCP server configuration (gitignored)
```

The original standalone repos ([Neocortica-Scholar](https://github.com/Pthahnix/Neocortica-Scholar), [Neocortica-Web](https://github.com/Pthahnix/Neocortica-Web)) are preserved for independent development, but the monorepo is the primary workspace.

## Research Pipeline

Five-stage iterative pipeline with review-driven quality loop: Topic → Literature Survey → Gap Analysis → Idea Generation → Review Loop → Experiment Design → Experiment Execution

Stages 1-3 are wrapped in a review loop: after each full pass, an independent Claude Code process reviews the outputs with web search verification, scores each stage (1-10), and selectively triggers re-runs of stages that need improvement. The loop continues until quality threshold is met (score >= 8/10, no critical issues) or 7 rounds max.

Each stage (1-4) uses SEARCH→READ→REFLECT→EVALUATE cycles with autonomous gap discovery and dynamic stopping conditions. Stage 5 deploys the full research context to a remote GPU pod via Git-based context transfer, where a fresh CC instance reads CLAUDE.md + MEMORY and executes the experiment autonomously.

**Key Features**:

- Review-driven loop: independent CC process (`claude -p`) reviews Stage 1-3 outputs with web search verification
- Selective redo: only re-runs stages that need improvement, with reduced iteration limits in hot loop
- 6 parallel searches per iteration (3 google-scholar-scraper + 3 brave_web_search)
- Two-step enrich pipeline: paper_searching → paper_fetching
- Web page pipeline: brave_web_search → web_fetching → web_content
- Three-pass reading protocol (High/Medium/Low rating)
- State inheritance between stages and across review rounds (knowledge + papersRead + urlsVisited)
- Zero external validation cost
- Dynamic stopping: gaps cleared, no progress for 3 rounds, or target reached
- Git-based context transfer: MEMORY → git push → pod git clone → CC reads context → executes experiment
- Dual pod targets: RunPod GPU pods and remote SSH servers

## Prerequisites

### Required MCP Servers

Neocortica uses a mix of local workspace packages and external npm MCP servers:

| MCP Server | Source | Purpose | API Key Required |
|---|---|---|---|
| **neocortica-scholar** | `packages/scholar` (workspace) | Academic paper pipeline (search, fetch, read, references) | MinerU token, OpenAI-compatible API key |
| **neocortica-web** | `packages/web` (workspace) | Web page fetching and caching (fetch, read) | Apify API token |
| **neocortica-session** | `packages/session` (workspace) | Git-based context transfer scripts | — |
| **apify** | `@apify/actors-mcp-server` (`npm install -g @apify/actors-mcp-server`) | Google Scholar search + web page scraping | [Apify API token](https://console.apify.com/account#/integrations) |
| **brave-search** | `@brave/brave-search-mcp-server` (`npm install -g @brave/brave-search-mcp-server`) | Web search API | [Brave Search API key](https://brave.com/search/api/) |
| **runpod** | `@runpod/mcp-server` (`npm install -g @runpod/mcp-server`) | GPU pod lifecycle (create/start/stop/delete) | [RunPod API key](https://www.runpod.io/console/user/settings) |
| **railway** | `@railway/mcp-server` (`npm install -g @railway/mcp-server`) | Deployment platform | [Railway API token](https://railway.app/account/tokens) |

## Quick Start

1. Clone and install (all workspace packages are installed automatically):

```bash
git clone https://github.com/Pthahnix/Neocortica.git
cd Neocortica
npm install
```

2. Install external MCP servers:

```bash
npm install -g @apify/actors-mcp-server @brave/brave-search-mcp-server @runpod/mcp-server @railway/mcp-server
```

3. Copy `.mcp.example.json` to `.mcp.json` and fill in your API keys and paths.

4. Set up `.env` (for pod provisioning via session-teleport):

```bash
ANTHROPIC_BASE_URL=https://your-api-provider.com
ANTHROPIC_AUTH_TOKEN=your-token
ANTHROPIC_MODEL=your-model
```

5. Claude Code will auto-discover all tools from the configured MCP servers.

### neocortica-scholar Configuration

Required environment variables (set in `.mcp.json` under the `neocortica-scholar` server entry):

| Variable | Description | How to Get |
|---|---|---|
| `MINERU_TOKEN` | MinerU API token for PDF → markdown conversion | [MinerU](https://mineru.net/) |
| `EMAIL` | Email for Unpaywall API (polite pool) | Your email |
| `NEOCORTICA_CACHE` | Cache directory path (**must be an absolute path**) | e.g., `D:/NEOCORTICA/.cache` |
| `OPENAI_API_KEY` | OpenAI-compatible API key (for AI paper reading) | [OpenRouter](https://openrouter.ai/) or any OpenAI-compatible provider |
| `OPENAI_BASE_URL` | API base URL | e.g., `https://openrouter.ai/api/v1` |
| `OPENAI_MODEL` | Model name for paper reading agent | e.g., `openai/gpt-oss-120b` |

### neocortica-web Configuration

Required environment variables (set in `.mcp.json` under the `neocortica-web` server entry):

| Variable | Description | How to Get |
|---|---|---|
| `NEOCORTICA_CACHE` | Cache directory path, shared with neocortica-scholar (**must be an absolute path**) | e.g., `D:/NEOCORTICA/.cache` |
| `APIFY_TOKEN` | Apify API token (for rag-web-browser) | [Apify](https://console.apify.com/account#/integrations) |

### neocortica-session Configuration

For Git-based context transfer to remote pods. Credentials are stored in `.mcp.json` under the `neocortica-session` server entry:

| Variable | Description |
|---|---|
| `RUNPOD_API_KEY` | RunPod API key (for RunPod pod targets) |
| `REMOTE_HOST` | SSH hostname/IP (for remote server targets) |
| `REMOTE_USER` | SSH username (for remote server targets) |
| `HF_TOKEN` | Hugging Face token (passed to pod for model downloads) |

## Tools

### neocortica-scholar (Academic Paper Pipeline)

| Tool | Description |
| ---- | ----------- |
| `paper_searching` | Enrich Google Scholar results into PaperMeta (arXiv, Semantic Scholar, Unpaywall) |
| `paper_fetching` | Fetch full paper as markdown (cache-first, multi-source fallback) |
| `paper_content` | Read cached paper markdown (local only, no network) |
| `paper_reference` | Get paper references via Semantic Scholar API |
| `paper_reading` | AI three-pass reading (Keshav method) via LLM agent |

### neocortica-web (Web Page Pipeline)

| Tool | Description |
| ---- | ----------- |
| `web_fetching` | Fetch web page as markdown via Apify rag-web-browser (cache-first) |
| `web_content` | Read cached web page markdown (local only, no network) |

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
    │  ┌─ Monorepo Packages ──────────────────────────────┐
    │  │                                                   │
    ├──┤  packages/scholar ─── academic paper pipeline     │
    │  │    ├── paper_searching  → enrich Scholar results  │
    │  │    ├── paper_fetching   → fetch full text         │
    │  │    ├── paper_content    → read cached markdown    │
    │  │    ├── paper_reference  → Semantic Scholar refs   │
    │  │    └── paper_reading    → AI three-pass reading   │
    │  │                                                   │
    ├──┤  packages/web ─── web page pipeline               │
    │  │    ├── web_fetching     → fetch page as markdown  │
    │  │    └── web_content      → read cached markdown    │
    │  │                                                   │
    ├──┤  packages/session ─── context transfer scripts    │
    │  │    └── scripts/         → pod provisioning        │
    │  └───────────────────────────────────────────────────┘
    │
    ├── @apify/actors-mcp-server ─── Google Scholar + web scraping
    │
    ├── @brave/brave-search-mcp-server ─── web search
    │
    ├── @runpod/mcp-server ─── GPU pod lifecycle
    │
    └── Git-based Context Transfer ─── distributed experiment execution
            ├── Local: MEMORY → git push → GitHub
            ├── Pod: git clone → deploy-context.sh → CC reads CLAUDE.md + MEMORY
            ├── Pod: experiment outputs → git push → GitHub
            └── Local: git pull → CC digests results
```

### Three-Layer Architecture

```
┌──────────────────────────────────────────────────────┐
│  SKILL LAYER (complex orchestration)                 │
│  skill/*.md — iteration loops, state management,     │
│  gap discovery, stopping conditions                  │
├──────────────────────────────────────────────────────┤
│  PIPELINE LAYER (fixed workflows)                    │
│  pipeline/*.md — tool orchestration, batching,       │
│  error handling                                      │
├──────────────────────────────────────────────────────┤
│  TOOL LAYER (MCP tools, atomic operations)           │
│  packages/scholar, packages/web, apify, brave, etc.  │
└──────────────────────────────────────────────────────┘
```

## Roadmap

### Review-Driven Research Loop — COMPLETED (v1.0.1)

Independent Claude Code process reviews Stage 1-3 outputs (survey, gap analysis, idea generation) with web search verification, scores each stage 1-10, and selectively re-runs stages that need improvement. Loops until quality threshold (score >= 8/10, no critical issues) or 7 rounds max.

### Git-based Context Transfer — COMPLETED (v1.1.0)

Replaced session export/import with Git-based context transfer. CLAUDE.md + MEMORY are the durable research context — pushed to GitHub, cloned on the pod. A fresh CC instance reads the context files and executes experiments autonomously. Experiment outputs return as structured files via git push/pull.

### Monorepo Consolidation — COMPLETED (v2.0.0)

Consolidated all MCP servers (neocortica-scholar, neocortica-web, neocortica-session) into a single npm workspaces monorepo. Added dual pod target support (RunPod GPU pods + remote SSH servers). Original standalone repos preserved for independent development.

### End-to-End Pipeline Validation — COMPLETED (v2.0.0)

Full research pipeline validated on the topic "AI Scientist" — survey → gap analysis → idea generation → review → experiment design. All MCP tools exercised: google-scholar-scraper (3 parallel searches, 30 results), paper_searching (8 enrichments), paper_fetching (8 full-text downloads), paper_reading (8 papers, 2 concurrent batches), paper_reference (1 citation trace), brave_web_search (4 queries), web_fetching (1 page). Review score: 8.2/10, all stages passed.

### Next

- End-to-end test: run full Stage 5 with real GPU pod (session-teleport → experiment → session-return)
- Adversarial Debate: Proposer-Critic-Judge architecture for idea validation
- Evolutionary Generation: MAP-Elites quality-diversity algorithm for idea evolution

## License

[Apache-2.0 License](LICENSE)
