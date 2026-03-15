# Web Searching Pipeline (web-searching)

Fixed workflow for searching the web via Brave Search and extracting full page content.

> **Interim version**: Uses `brave_web_search` (brave-search MCP) and `rag-web-browser` (apify MCP) directly. Will migrate to `web_searching` / `web_fetching` tools from neocortica-web MCP when available.

## Input

- `queries: string[]` — 1-3 search keywords
- `maxResultsPerQuery: number` — default 3
- `urlsVisited: Set<string>` — URLs already processed (for cross-iteration dedup)

## Output

- `WebMeta[]` — web page metadata. Each object contains:
  - `url`, `title`, `description`, `snippet`
  - `markdownPath?` — non-empty if full content fetched and cached
  - `fetchFailed?` — true if extraction was attempted but failed

## Execution

### DISCOVER phase

For each query, call in parallel:

```
brave_web_search({ query: query, count: maxResultsPerQuery })
```

Merge all results. Deduplicate by URL. Skip URLs already in `urlsVisited`.

### EXTRACT phase

Select top N URLs by relevance from DISCOVER results (N = total unique URLs, capped at 15).

For each URL (max 5 in parallel):

```
rag-web-browser({ query: url, maxResults: 1, outputFormats: ["markdown"] })
```

The returned markdown content should be saved to the local cache directory at `CACHE/web/<normalized_url>.md` using the Write tool. Use the URL hostname + path as the filename, replacing non-alphanumeric characters with `_`.

If extraction fails (anti-scrape, timeout, empty content), set `fetchFailed = true` on the WebMeta entry and continue.

## Error Handling

| Failure | Action |
|---|---|
| `brave_web_search` failure | Retry 1x, skip on second failure |
| `rag-web-browser` failure (anti-scrape/timeout) | Skip, mark `fetchFailed = true` |
| All extractions fail | Degrade: return WebMeta with Brave snippets only (no markdownPath) |

## Notes

- DISCOVER phase uses Brave Search (fast, independent index, <1s per query).
- EXTRACT phase uses Apify RAG Web Browser (full page content, JS rendering, 16-31s per page).
- Separating discovery from extraction is more efficient than using RAG for both. See `.context/2026-03-15-brave-vs-rag-web-browser.md` for rationale.
- Cache path convention: `CACHE/web/` + normalized URL (lowercase, non-alphanum → `_`).
- **Migration note**: When neocortica-web MCP is built, replace `brave_web_search` with `web_searching` and `rag-web-browser` + manual caching with `web_fetching` (which handles caching internally).
