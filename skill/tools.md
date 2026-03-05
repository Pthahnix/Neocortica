# Neocortica — Tool Reference

MCP server with 5 tools for academic research and web content retrieval. All tools cache results locally under `DIR_CACHE`.

## Tools

### paper_content

Convert a single paper to markdown. Smart routing based on input type.

| Param | Type | Description |
| ------- | ------ | ------------- |
| `title` | string? | Paper title (triggers title→markdown pipeline) |
| `url` | string? | arXiv URL or PDF URL |
| `dir` | string? | Local PDF file path |

Routing logic:

- arXiv URL → fetch metadata by ID + convert via arxiv2md.org
- PDF URL or local path → convert via MinerU
- Title only → fallback chain: arXiv search → Semantic Scholar → Unpaywall OA PDF → MinerU

Returns `PaperResult` with `markdownDir` pointing to cached full-text.

### acd_search

Broad academic search. Queries Google Scholar, fetches full text for each result.

| Param | Type | Description |
| ------- | ------ | ------------- |
| `query` | string | Search keywords for Google Scholar |

Pipeline: Google Scholar (via Apify) → for each paper, attempt arXiv content → fallback to title2markdown pipeline. Processes in batches of 3.

Returns `PaperResult[]` — each with metadata and `markdownDir` where content was obtained.

### dfs_search

Deep reference exploration. Follows a paper's references recursively via Semantic Scholar.

| Param | Type | Description |
| ------- | ------ | ------------- |
| `title` | string | Paper title |
| `normalizedTitle` | string | Normalized title for dedup |
| `s2Id` | string? | Semantic Scholar paper ID (looked up if omitted) |
| `depth` | number | Max recursion depth |
| `breadth` | number | Max references per level |
| `visited` | string[]? | Already visited normalizedTitles |

Returns flat `PaperResult[]` of all discovered papers across all depth levels.

### web_search

Search the web via Brave Search API. Returns result list without content.

| Param | Type | Description |
| ------- | ------ | ------------- |
| `query` | string | Search query |
| `count` | number? | Max results (default 10) |

Returns `WebResult[]` with `title`, `url`, `description`. Use `web_content` to fetch full page markdown.

### web_content

Fetch a web page and convert to markdown. Caches locally.

| Param | Type | Description |
| ------- | ------ | ------------- |
| `url` | string | URL to fetch |
| `title` | string? | Page title (derived from URL if omitted) |

Returns `WebResult` with `markdownDir` pointing to cached markdown file.

## Data Types

```typescript
PaperResult {
  title, normalizedTitle,
  arxivId?, doi?, s2Id?,
  year?, authors?, abstract?, citationCount?,
  arxivUrl?, pdfUrl?, sourceUrl?,
  markdownDir?  // path to cached full-text markdown
}

WebResult {
  title, normalizedTitle, url,
  description?,
  markdownDir?  // path to cached page markdown
}
```

## Cache Structure

- `DIR_CACHE/markdown/` — paper full-text (.md)
- `DIR_CACHE/paper/` — paper metadata (.json)
- `DIR_CACHE/web/` — web page content (.md)

Filenames are normalized: lowercase, non-alphanumeric → `_`, no trailing `_`.

## Tool Usage in Iterative Loop Engine

All research skills (literature-survey, gap-analysis, idea-generation, experiment-design) use only the 5 free tools above. The iterative loop engine achieves comprehensive research through:

- **Parallel searches**: 6 searches per iteration (3 queries × 2 tools)
- **Iterative refinement**: SEARCH→READ→REFLECT→EVALUATE cycle
- **Autonomous gap discovery**: System identifies missing information and searches again
- **Dynamic stopping**: Continues until knowledge is sufficient, not fixed iteration count

**No external validation tools needed** — quality control is built into the loop through self-reflection and evaluation.
