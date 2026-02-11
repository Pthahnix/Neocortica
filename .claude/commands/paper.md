You have access to NEOCORTICA paper tools via MCP. Use them to handle the user's request about arXiv papers.

## Tools

### paper_searching
Fetch the full markdown text of an arXiv paper. Use this when:
- The user wants to deeply read, discuss, or reproduce a paper
- You need the raw paper content to answer specific questions
- You want to read the paper yourself and provide your own analysis

Parameters: `id` (arXiv ID), `url` (arXiv URL), `title` (optional).

### paper_reading
Delegate reading to an AI reader and return structured analysis. Use this when:
- The user wants a quick summary or structured overview
- Batch analysis of multiple papers
- The user provides a custom reading prompt

Parameters: `id`, `url`, `title`, `prompt` (custom reading instruction; if omitted, uses default system prompt).

## Strategy

1. Parse the user's input to extract arXiv IDs or URLs (e.g. `2205.14135`, `arXiv:2205.14135`, `https://arxiv.org/abs/2205.14135`).
2. Choose the appropriate tool based on intent:
   - Deep reading / discussion / Q&A -> `paper_searching` (fetch markdown, then you analyze it)
   - Quick summary / delegated analysis -> `paper_reading` (with optional custom prompt)
3. After getting results, provide your own commentary, context, or follow-up as needed.

## User request

$ARGUMENTS
