# NEOCORTICA

- [NEOCORTICA](#neocortica)
  - [Setup](#setup)
  - [Usage](#usage)
    - [Slash command](#slash-command)
    - [Direct tool calls](#direct-tool-calls)

arXiv paper search & AI reading tool, exposed as a Claude Code MCP server.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` with your OpenRouter API key:

   ```bash
   BASE_URL_OPENROUTER=https://openrouter.ai/api/v1
   API_KEY_OPENROUTER=sk-or-v1-xxxxx
   ```

3. The MCP server is already registered in `.mcp.json`. Restart Claude Code to pick it up.

## Usage

### Slash command

```bash
/paper read https://arxiv.org/abs/2205.14135
/paper what are the main contributions of 2205.14135
```

### Direct tool calls

Claude Code will automatically have access to two tools:

**paper_searching** — fetch paper markdown

```bash
Use paper_searching with id "2205.14135"
```

**paper_reading** — AI-powered paper analysis (3-step structured reading)

```bash
Use paper_reading with url "https://arxiv.org/abs/2205.14135"
```

**paper_reading with custom prompt** — ask a specific question

```bash
Use paper_reading with id "2205.14135" and prompt "What datasets were used for evaluation?"
```
