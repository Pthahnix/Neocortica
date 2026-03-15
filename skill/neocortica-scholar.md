# Neocortica-Scholar MCP Tools Usage Guide

## Overview

5 MCP tools forming an academic paper processing pipeline:

```
Google Scholar (Apify) → paper_searching → paper_fetching → paper_content
                                                           → paper_reference
                                                           → paper_reading
```

Typical workflow: scrape Google Scholar via Apify, then sequentially searching → fetching → content/reference/reading.

---

## Tool 1: paper_searching

**Purpose**: Enrich raw Google Scholar results into PaperMeta with arXiv, Semantic Scholar, and Unpaywall metadata.

**Input**: A single result from Apify `marco.gullo/google-scholar-scraper`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| title | string | Recommended | Paper title |
| link | string | No | Scholar source URL (arxivId extracted automatically if contains arxiv.org) |
| authors | string | No | Authors |
| year | string/number | No | Publication year |
| citations | string/number | No | Citation count |
| searchMatch | string | No | Scholar abstract snippet |
| documentLink | string | No | Scholar direct link (**never used as oaPdfUrl**) |

**Output**: PaperMeta JSON with `arxivUrl`, `oaPdfUrl`, `s2Id`, `doi`, `abstract`, etc.

**Enrichment priority**: arXiv > Semantic Scholar > Unpaywall

**Example**:
```
paper_searching({
  title: "Attention Is All You Need",
  link: "https://arxiv.org/abs/1706.03762",
  authors: "Vaswani et al.",
  year: 2017
})
```

**Notes**:
- `oaPdfUrl` is only sourced from SS `openAccessPdf` or Unpaywall — **never** from Scholar `documentLink`
- May timeout on unstable networks; retry usually works
- Process sequentially (one at a time) to avoid API rate limits

---

## Tool 2: paper_fetching

**Purpose**: Fetch full paper as markdown. Cache-first, multiple source fallbacks.

**Fetching priority chain**:
```
cache hit → pdfPath (local PDF via MinerU) → arxivUrl (arxiv2md → arxiv PDF via MinerU) → oaPdfUrl (MinerU) → return without markdownPath
```

**Input**: PaperMeta fields.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| title | string | Recommended | Paper title (auto-derived from filename when using pdfPath) |
| normalizedTitle | string | Recommended | Cache key (overridden when using pdfPath) |
| arxivUrl | string | No | arXiv abs URL for arxiv2md conversion |
| arxivId | string | No | arXiv ID; used as fallback when arxiv2md fails (PDF via MinerU) |
| oaPdfUrl | string | No | OA PDF URL for MinerU conversion |
| pdfPath | string | No | Absolute path to local PDF for MinerU conversion |
| doi, s2Id, abstract, year, authors, citationCount, sourceUrl | - | No | Pass-through metadata |

**Output**: PaperMeta JSON with `markdownPath` on success.

**Example**:

```
# Fetch from paper_searching result
paper_fetching({
  title: "Attention Is All You Need",
  normalizedTitle: "attention_is_all_you_need",
  arxivUrl: "https://arxiv.org/abs/1706.03762"
})

# Fetch from local PDF (title/normalizedTitle auto-derived from filename)
paper_fetching({
  pdfPath: "D:\\path\\to\\.cache\\pdf\\Attention Is All You Need.pdf"
})
```

**Known failure scenarios**:

| Failure Type | Cause | Handling |
|-------------|-------|----------|
| arxiv2md conversion failure | Complex LaTeX, very long papers | Falls back to arxiv PDF via MinerU; ~4% papers may still fail |
| oaPdfUrl MinerU failure | DOI redirect URL points to HTML landing page/paywall instead of PDF | Cannot retry; MCP error indicates a problematic paper |
| Network timeout | Unstable network | **Retryable** — usually succeeds on retry |
| MinerU slow processing | VLM model processing PDF takes time | Normal; 1-5 minutes per paper |

**Important**:
- When using `pdfPath`, `normalizedTitle` is **always overridden** to `normTitle(basename(pdfPath, ".pdf"))`
- Process sequentially for batch fetching — do not parallelize (MinerU API limits + network stability)
- Successfully fetched markdown and metadata are auto-cached; subsequent calls hit cache instantly

---

## Tool 3: paper_content

**Purpose**: Read cached paper markdown content. Purely local, no network requests.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| title | string | Either one | Full paper title (looked up via `normTitle()` conversion) |
| normalizedTitle | string | Either one | Specify normalizedTitle directly |

**Output**: Full paper markdown text, or "Paper not found in cache."

**Example**:
```
# Using normalizedTitle (recommended, more reliable)
paper_content({ normalizedTitle: "attention_is_all_you_need" })

# Using title (must be complete, not truncated)
paper_content({ title: "Attention Is All You Need" })
```

**Critical: title must match exactly**

`paper_content` locates cache files by converting the title via `normTitle(title)`. Incomplete or mismatched titles will fail to find the paper.

- "ChatGPT for Shaping the Future of Dentistry" → **not found**
- "ChatGPT for Shaping the Future of Dentistry: the Potential of Multi Modal Large Language Model" → **found**

**Recommendation**: Prefer `normalizedTitle` (from `paper_fetching` return value) to avoid title matching issues.

---

## Tool 4: paper_reference

**Purpose**: Get all references of a paper. Primary path uses Semantic Scholar API; falls back to markdown parsing when no identifiers are available.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| title | string | Yes | Paper title |
| normalizedTitle | string | Yes | Normalized title |
| s2Id | string | No | Semantic Scholar ID (optimal) |
| arxivId | string | No | arXiv ID (e.g., 2301.00001) |
| doi | string | No | DOI |
| markdownPath | string | No | Cached markdown path (for fallback parsing) |

**Lookup priority**: `s2Id` > `arxivId` (as `ARXIV:xxx`) > `doi` (as `DOI:xxx`) > markdown parsing

**Output**: PaperMeta[] — metadata for each reference.

**Example**:
```
paper_reference({
  title: "Attention Is All You Need",
  normalizedTitle: "attention_is_all_you_need",
  arxivId: "1706.03762",
  markdownPath: "D:\\...\\attention_is_all_you_need.md"
})
```

**Notes**:
- SS API paginates through all references; may be slow on unstable networks
- Markdown fallback parses the References section and enriches each title (batches of 3)
- Providing `markdownPath` ensures fallback is available

**Important: SS API path returns incomplete information**

When using the SS API path, `paper_reference` does **not** call `paper_searching` (enrichMeta). The returned PaperMeta only contains fields from the SS database; some papers may lack `abstract`, `arxivUrl`, `oaPdfUrl`, etc.

To get complete information (especially for subsequent full-text fetching), run `paper_searching` on each result:

```
paper_reference → paper_searching → paper_fetching
  (SS basic info)   (fill arxivUrl/    (download full text)
                    oaPdfUrl/abstract)
```

Only the markdown fallback path automatically calls `enrichMeta()`, since it can only extract titles from markdown.

---

## Tool 5: paper_reading

**Purpose**: AI three-pass reading (Keshav method). Uses an LLM agent to read paper markdown and generate a structured report.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| papers | array | Yes | `[{ markdownPath, title? }]` — papers to read |
| prompt | string | No | Custom reading prompt (defaults to three-pass Keshav prompt) |
| batchSize | number | No | Papers per agent (default: 1) |
| concurrency | number | No | Parallel agents (default: 1) |

**Output**: `ReadingResult[]`, each containing `report` (reading report) and `papers` (paper title list).

**Example**:
```
paper_reading({
  papers: [
    { markdownPath: "D:\\...\\attention_is_all_you_need.md", title: "Attention Is All You Need" }
  ]
})

# Batch reading: 2 papers per batch, 2 parallel agents
paper_reading({
  papers: [...],
  batchSize: 2,
  concurrency: 2
})
```

**Required environment variables**:
- `OPENAI_API_KEY` — required
- `OPENAI_BASE_URL` — required
- `OPENAI_MODEL` — optional, default `openai/gpt-oss-120b`

---

## Typical Workflow Examples

### 1. Search and fetch papers from Google Scholar

```
# Step 1: Scrape Google Scholar via Apify
apify marco.gullo/google-scholar-scraper({ keyword: "LLM agents", maxItems: 20 })

# Step 2: Enrich each result
For each result → paper_searching({ title, link, authors, year, ... })

# Step 3: Fetch papers with OA sources (sequentially!)
For those with arxivUrl/oaPdfUrl → paper_fetching({ ...paperMeta })

# Step 4: Read
For those with markdownPath → paper_reading({ papers: [{ markdownPath, title }] })
```

### 2. Process local PDFs

```
# Fetch directly (title/normalizedTitle auto-derived)
paper_fetching({ pdfPath: "D:\\path\\to\\paper.pdf" })

# Then read content
paper_content({ normalizedTitle: "obtained_from_return_value" })
```

### 3. Explore references

```
# Step 1: Get reference list (SS API basic info)
paper_reference({ title, normalizedTitle, arxivId, markdownPath })
  → Returns PaperMeta[], but may lack arxivUrl/oaPdfUrl/abstract

# Step 2: Enrich each reference (fill complete metadata)
For each reference → paper_searching({ title: ref.title, link: ref.sourceUrl, ... })
  → Fills arxivUrl, oaPdfUrl, abstract, etc.

# Step 3: Fetch papers with OA sources
For those with arxivUrl/oaPdfUrl → paper_fetching({ ...enrichedMeta })

# Step 4: Read
For those with markdownPath → paper_reading({ papers: [{ markdownPath, title }] })
```

---

## General Notes

1. **Unstable networks**: Tools involving external APIs (searching, fetching, reference) may fail on poor networks — **retrying usually resolves the issue**
2. **Sequential execution**: Process papers one at a time for batch operations to avoid rate limits or timeouts
3. **MinerU processing time**: PDF → markdown conversion (local PDF or oaPdfUrl) takes 1-5 minutes per paper — this is normal
4. **Caching**: paper_fetching auto-caches on success; subsequent calls for the same paper return instantly
5. **Failure = problematic paper**: paper_fetching errors typically mean the paper genuinely cannot be fetched (arxiv2md limitation or oaPdfUrl pointing to non-PDF); no need to retry repeatedly
