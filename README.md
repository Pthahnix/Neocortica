# NEOCORTICA

arXiv paper search & AI-powered reading tool, exposed as a [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for Claude Code.

> **This is a personal demo / toy project (v2.0.0).** It is not intended for production use or public consumption. The hosted backend requires an API key — if you're interested in trying it out, reach out to me directly.

## Architecture

```bash
Claude Code ←stdio→ MCP Client (local) ←HTTPS→ Backend API (Railway)
                                                    ├── arXiv fetch
                                                    ├── arxiv2md conversion
                                                    └── LLM reading (OpenRouter)
```

- `mcp/` — lightweight local MCP server that forwards requests to the backend via HTTP
- `backend/` — Hono HTTP API deployed on Railway, handles paper fetching and AI analysis

## Tools

| Tool | Description |
| ------ | ------------- |
| `paper_searching` | Fetch the full markdown text of an arXiv paper |
| `paper_reading` | AI-powered structured paper analysis, with optional custom prompt |

## Setup (for reference)

This requires a valid `NEOCORTICA_API_KEY` to access the hosted backend.

1. Clone the repo and install MCP client dependencies:

   ```bash
   cd mcp && npm install
   ```

2. Copy `.mcp.example.json` to `.mcp.json` and fill in your credentials:

   ```json
   {
     "mcpServers": {
       "neocortica": {
         "command": "npx",
         "args": ["tsx", "mcp/src/mcp_server.ts"],
         "env": {
           "NEOCORTICA_API_URL": "https://neocortica-production.up.railway.app",
           "NEOCORTICA_API_KEY": "your_api_key"
         }
       }
     }
   }
   ```

3. Restart Claude Code to pick up the MCP server.

## Usage

### Slash command

```bash
/paper arxiv 2205.14135
/paper read https://arxiv.org/abs/2205.14135
```

### Direct tool calls

```bash
Use paper_searching with id "2205.14135"
Use paper_reading with id "2205.14135"
Use paper_reading with id "2205.14135" and prompt "What datasets were used?"
```

## Self-hosting

If you want to run your own backend, see `.env.example` for the required environment variables. You'll need an OpenRouter (or compatible) API key for the LLM reading feature.

## License

MIT
