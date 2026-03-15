# Neocortica-Web MCP Tools Usage Guide

## Overview

2 MCP tools for web page fetching and caching:

```
Brave Search (existing MCP) → web_fetching → web_content
```

Typical workflow: search via Brave, then fetch each URL via `web_fetching`, later read via `web_content`.

> **Note**: For batch web searching workflows (Brave → fetch → read), prefer using the `web-searching` pipeline which orchestrates these tools automatically. This guide is reference material for understanding individual tool parameters and behavior.

---

## Tool 1: web_fetching

**Purpose**: Fetch a single web page as markdown via Apify rag-web-browser, cache the result locally.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| url | string | Yes | URL to fetch |
| title | string | No | Page title (if known from Brave results) |

**Output**: WebMeta JSON with `markdownPath` on success, `fetchFailed: true` on failure.

**Cache behavior**:
- Cache hit (markdown exists): returns immediately, no network call
- Cache hit (fetchFailed meta exists): returns cached failure, no retry
- Cache miss: calls Apify rag-web-browser, saves result to `CACHE/web/`

**Example**:
```
web_fetching({ url: "https://example.com/page", title: "Example Page" })
```

**Error handling**:
- Anti-scrape, timeout, empty content → returns `fetchFailed: true`, saves failure meta
- Subsequent calls for same URL → returns cached failure (no retry)
- To force retry: manually delete `CACHE/web/{normalizedUrl}.json`

**Important**:
- Process sequentially for batch fetching — Apify compute limits
- Typical fetch time: 16-31 seconds per page
- Successfully fetched pages are auto-cached; subsequent calls return instantly

---

## Tool 2: web_content

**Purpose**: Read cached web page markdown. Purely local, no network requests.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| url | string | Either one | Original URL (converted via normUrl) |
| normalizedUrl | string | Either one | Normalized URL for direct cache lookup |

**Output**: Raw markdown content on success, "Page not found in cache." on miss.

**Example**:
```
# Using normalizedUrl (recommended)
web_content({ normalizedUrl: "example_com_page" })

# Using original URL
web_content({ url: "https://example.com/page" })
```

**Recommendation**: Prefer `normalizedUrl` from `web_fetching` return value for reliable cache hits.

**normUrl examples** (how URLs become cache keys):
- `https://github.com/foo/bar` → `github_com_foo_bar`
- `https://arxiv.org/html/2503.12434v1` → `arxiv_org_html_2503_12434v1`
- `https://example.com/path?q=test#section` → `example_com_path`

---

## Typical Workflow

```
# Step 1: Search via Brave
brave_web_search({ query: "LLM agents tutorial" })

# Step 2: Fetch each interesting URL
web_fetching({ url: "https://example.com/llm-guide", title: "LLM Guide" })

# Step 3: Read cached content
web_content({ normalizedUrl: "example_com_llm_guide" })
```

---

## General Notes

1. **Sequential processing**: Fetch pages one at a time to respect Apify compute limits
2. **Caching**: `web_fetching` auto-caches on success AND failure; subsequent calls return instantly
3. **Failure = problematic page**: `fetchFailed` usually means anti-scrape or timeout — no need to retry repeatedly
4. **Cache location**: `NEOCORTICA_CACHE/web/` shared with neocortica-scholar's `markdown/` and `paper/` dirs
