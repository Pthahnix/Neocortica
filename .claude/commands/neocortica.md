Use the neocortica MCP tools to work with arXiv papers.

## Tool Selection

**Default: use `paper_reading` only.** This tool fetches the paper markdown internally and then runs AI analysis on it — it is the complete pipeline. Do NOT also call `paper_searching` alongside it; that would be redundant.

Only use `paper_searching` when the user explicitly asks for the raw markdown text of a paper without any AI analysis (e.g. "fetch me the markdown of this paper", "get the raw text").

## Tools

### paper_reading
Fetches an arXiv paper and returns a structured AI analysis.
- Parameters: `id` (arXiv ID like "2205.14135"), `url` (arXiv URL), `title` (optional), `prompt` (optional custom analysis prompt)
- Provide either `id` or `url`, not both.
- If the user asks for a specific analysis angle or has a particular question about the paper, pass it as the `prompt` parameter.
- If no `prompt` is given, the tool uses a default structured analysis pipeline.

### paper_searching
Fetches the full markdown text of an arXiv paper without AI analysis.
- Parameters: `id` (arXiv ID), `url` (arXiv URL), `title` (optional)
- Only use this when the user wants raw paper content, not analysis.

## Input Handling

The user input is provided via $ARGUMENTS. It can be:
- An arXiv ID: "2205.14135" → pass as `id`
- An arXiv URL: "https://arxiv.org/abs/2205.14135" → pass as `url`
- An ID/URL followed by a question or instruction → pass the ID/URL as `id` or `url`, and the rest as `prompt`

Examples:
- `/neocortica 2205.14135` → call `paper_reading` with `id: "2205.14135"`
- `/neocortica https://arxiv.org/abs/2205.14135` → call `paper_reading` with `url: "https://arxiv.org/abs/2205.14135"`
- `/neocortica 2205.14135 what novel methods does this paper propose?` → call `paper_reading` with `id: "2205.14135"` and `prompt: "what novel methods does this paper propose?"`
- `/neocortica fetch markdown 2205.14135` → call `paper_searching` with `id: "2205.14135"`

$ARGUMENTS
