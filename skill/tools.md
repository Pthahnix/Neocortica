# Neocortica — Tool Reference

Research toolkit using external MCP servers for academic search, web retrieval, and GPU pod management.

## MCP Servers & Tools

### neocortica-scholar (Academic Paper Pipeline)

See `/neocortica-scholar` skill for detailed usage guide.

| Tool | Purpose |
|------|---------|
| `paper_searching` | Enrich Google Scholar results into PaperMeta (arXiv, SS, Unpaywall) |
| `paper_fetching` | Fetch full paper as markdown (cache-first, multi-source fallback) |
| `paper_content` | Read cached paper markdown (local only, no network) |
| `paper_reference` | Get paper references via Semantic Scholar API |
| `paper_reading` | AI three-pass reading (Keshav method) via LLM agent |

### apify (Google Scholar + Web Scraping)

| Tool | Purpose |
|------|---------|
| `marco.gullo/google-scholar-scraper` | Search Google Scholar, returns raw results |
| `apify/rag-web-browser` | Fetch web page as markdown |

### brave-search (Web Search)

| Tool | Purpose |
|------|---------|
| `brave_web_search` | Web search via Brave Search API |

### runpod (GPU Pod Lifecycle)

| Tool | Purpose |
|------|---------|
| `create-pod` | Create GPU pod |
| `start-pod` / `stop-pod` / `delete-pod` | Pod lifecycle management |
| `list-pods` / `get-pod` | Pod status queries |

## Academic Search Pipeline

```
google-scholar-scraper → paper_searching → paper_fetching → paper_content
                                                           → paper_reference
                                                           → paper_reading
```

1. **Search**: `google-scholar-scraper` × N queries (parallel)
2. **Enrich**: `paper_searching` per result (sequential, avoid rate limits)
3. **Fetch**: `paper_fetching` for those with arxivUrl/oaPdfUrl (sequential)
4. **Read**: `paper_content` for cached text, or `paper_reading` for AI analysis

## Reference Exploration Pipeline

```
paper_reference → paper_searching → paper_fetching
```

1. **References**: `paper_reference` returns PaperMeta[] (SS basic info only)
2. **Enrich**: `paper_searching` per reference (fills arxivUrl/oaPdfUrl/abstract)
3. **Fetch**: `paper_fetching` for enriched references with OA sources

## Data Types

```typescript
PaperMeta {
  title, normalizedTitle,        // required
  arxivId?, doi?, s2Id?,         // identifiers
  abstract?, arxivUrl?, oaPdfUrl?, pdfPath?,  // metadata
  year?, authors?, citationCount?, sourceUrl?,
  markdownPath?                  // path to cached full-text markdown
}

ScholarItem {
  title?, link?, authors?, year?,
  citations?, searchMatch?, documentLink?
}
```

## Cache

Managed by neocortica-scholar via `NEOCORTICA_CACHE` env var:
- `markdown/` — paper full-text (.md)
- `paper/` — paper metadata (.json)

Filenames normalized: lowercase, non-alphanumeric → `_`, no trailing `_`.

## Tool Usage in Iterative Loop Engine

All research skills use the same search pattern per iteration:

- **Parallel searches**: `google-scholar-scraper` × 3 + `brave_web_search` × 3 = 6 searches
- **Sequential enrichment**: Scholar results → `paper_searching` → `paper_fetching`
- **Iterative refinement**: SEARCH→READ→REFLECT→EVALUATE cycle
- **Autonomous gap discovery**: System identifies missing information and searches again
- **Dynamic stopping**: Continues until knowledge is sufficient, not fixed iteration count
