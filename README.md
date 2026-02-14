# NEOCORTICA

![NEOCORTICA](./assets/cover.png)

> **Note:** This project is currently a personal demo / prototype and is not ready for general use. The backend service and API keys are private, so cloning this repo alone won't give you a working setup. Feel free to browse the code for reference or inspiration.

An MCP (Model Context Protocol) server for reading and analyzing arXiv papers with AI. Works with Claude Code and other MCP-compatible clients.

## Prerequisites

- Node.js >= 18
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (or any MCP-compatible client)

## Setup

### 1. Clone and install

```bash
git clone https://github.com/Pthahnix/NEOCORTICA_MCP.git
cd NEOCORTICA_MCP
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
API_KEY_NEOCORTICA='your_api_secret'
BASE_URL_NEOCORTICA='https://neocortica-railway-production.up.railway.app'
```

### 3. Configure MCP

The repo includes a `.mcp.json` that Claude Code picks up automatically when you open the project directory. No extra configuration needed — just `cd` into the project and start Claude Code:

```bash
cd NEOCORTICA_MCP
claude
```

Claude Code will detect the `.mcp.json` and register the `neocortica` MCP server.

If you want to use it from a different project directory, copy the MCP config into that project's `.mcp.json`:

```json
{
  "mcpServers": {
    "neocortica": {
      "command": "npx",
      "args": ["tsx", "src/mcp_server.ts"],
      "cwd": "/absolute/path/to/NEOCORTICA_MCP"
    }
  }
}
```

## Usage

The repo includes a `/neocortica` slash command (in `.claude/commands/neocortica.md`). In Claude Code:

```bash
/neocortica 2205.14135
```

```bash
/neocortica 2205.14135 What novel methods does this paper propose?
```

```bash
/neocortica https://arxiv.org/abs/2205.14135
```

You can also call the MCP tools directly without the slash command — just ask Claude to use `paper_reading` or `paper_searching`.

## Tools

| Tool | Description |
| ---- | ----------- |
| `paper_reading` | Fetch + AI analysis of an arXiv paper. This is the primary tool. |
| `paper_searching` | Fetch raw markdown of an arXiv paper without AI analysis. |

## Quick Start Test

```bash
/neocortica arxiv:2601.03267, Analyze the key contributions, methodology, and limitations of this paper. Highlight what makes it significant in the context of prior work.
```
