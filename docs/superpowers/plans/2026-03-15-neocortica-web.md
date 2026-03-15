# neocortica-web MCP Server Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight MCP server (`neocortica-web`) that fetches web pages as markdown via Apify REST API and caches them locally, then migrate the web-searching pipeline to use it.

**Architecture:** Two tools (`web_fetching`, `web_content`) in a standalone Node.js MCP server at `D:\NEOCORTICA-WEB`. Calls Apify `rag-web-browser` actor directly via REST API (not through MCP). Mirrors neocortica-scholar's project structure exactly.

**Tech Stack:** Node.js ESM, TypeScript, `@modelcontextprotocol/sdk`, `zod`, `dotenv`, Node.js built-in `test` module

**Spec:** `D:\NEOCORTICA\docs\superpowers\specs\2026-03-15-neocortica-web-design.md`

**Reference implementation:** `D:\NEOCORTICA-SCHOLAR` (follow this project's exact patterns)

---

## File Map

### New files at `D:\NEOCORTICA-WEB`

| File | Responsibility |
|------|---------------|
| `package.json` | Project config: `"type": "module"`, deps, scripts |
| `tsconfig.json` | TypeScript config matching neocortica-scholar |
| `.env` | `APIFY_TOKEN`, `NEOCORTICA_CACHE` |
| `.env.example` | Template for `.env` |
| `.mcp.example.json` | MCP config template |
| `.gitignore` | node_modules, dist, .env, .cache |
| `src/types.ts` | `WebMeta` interface |
| `src/utils/misc.ts` | `normUrl()` function |
| `src/utils/cache.ts` | `saveMarkdown`, `saveMeta`, `loadMeta`, `loadMarkdownPath`, `ensureDirs` |
| `src/utils/apify.ts` | `runActor`, `waitForRun`, `getDatasetItems` |
| `src/tools/web_fetching.ts` | `webFetching()` — cache-first → Apify → save |
| `src/tools/web_content.ts` | `webContent()` — read cached markdown |
| `src/mcp_server.ts` | MCP server entry, registers 2 tools |
| `.test/utils/misc.test.ts` | normUrl tests |
| `.test/utils/cache.test.ts` | cache save/load tests |
| `.test/utils/apify.test.ts` | Apify REST API client simulation tests |
| `.test/tools/web_fetching.test.ts` | web_fetching tool simulation tests |
| `.test/tools/web_content.test.ts` | web_content tool tests |
| `.test/integration.test.ts` | Real Apify API end-to-end test |

### Modified files in `D:\NEOCORTICA` (main repo)

| File | Change |
|------|--------|
| `.mcp.json` | Add `neocortica-web` server entry |
| `pipeline/web-searching.md` | Migrate from interim (rag-web-browser) to neocortica-web tools |
| `.claude/commands/web-searching.md` | Sync with pipeline file |
| `skill/neocortica-web.md` | New tool usage guide |
| `CLAUDE.md` | Add neocortica-web to MCP servers table |

---

## Chunk 1: Project Scaffold + Utils

### Task 1: Project Scaffold

**Files:**
- Create: `D:\NEOCORTICA-WEB\package.json`
- Create: `D:\NEOCORTICA-WEB\tsconfig.json`
- Create: `D:\NEOCORTICA-WEB\.env`
- Create: `D:\NEOCORTICA-WEB\.env.example`
- Create: `D:\NEOCORTICA-WEB\.gitignore`
- Create: `D:\NEOCORTICA-WEB\.mcp.example.json`

- [ ] **Step 1: Create project directory and initialize git**

```bash
mkdir -p D:/NEOCORTICA-WEB/src/{tools,utils}
mkdir -p D:/NEOCORTICA-WEB/.test/{tools,utils}
cd D:/NEOCORTICA-WEB && git init
```

- [ ] **Step 2: Write `package.json`**

Create `D:\NEOCORTICA-WEB\package.json`:

```json
{
  "name": "neocortica-web",
  "version": "0.1.0",
  "description": "MCP server for web page fetching and caching via Apify rag-web-browser",
  "type": "module",
  "scripts": {
    "mcp": "tsx src/mcp_server.ts",
    "test": "tsx --test .test/**/*.test.ts",
    "build": "tsc"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.26.0",
    "dotenv": "^17.3.1",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/node": "^25.3.0",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

Create `D:\NEOCORTICA-WEB\tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Write `.gitignore`**

Create `D:\NEOCORTICA-WEB\.gitignore`:

```
node_modules/
dist/
.env
.cache/
.mcp.json
```

- [ ] **Step 5: Write `.env.example`**

Create `D:\NEOCORTICA-WEB\.env.example`:

```
APIFY_TOKEN=
NEOCORTICA_CACHE=.cache
```

- [ ] **Step 6: Write `.env`**

Create `D:\NEOCORTICA-WEB\.env` — copy the `APIFY_TOKEN` value from `D:\NEOCORTICA\.mcp.json` (the `apify` server's env block). Set `NEOCORTICA_CACHE=.cache`.

- [ ] **Step 7: Write `.mcp.example.json`**

Create `D:\NEOCORTICA-WEB\.mcp.example.json`:

```json
{
  "mcpServers": {
    "neocortica-web": {
      "command": "npm",
      "args": ["run", "mcp"],
      "env": {
        "APIFY_TOKEN": "",
        "NEOCORTICA_CACHE": ".cache"
      }
    }
  }
}
```

- [ ] **Step 8: Install dependencies**

```bash
cd D:/NEOCORTICA-WEB && npm install
```

- [ ] **Step 9: Commit scaffold**

```bash
cd D:/NEOCORTICA-WEB
git add -A
git commit -m "chore: scaffold neocortica-web project"
```

---

### Task 2: types.ts

**Files:**
- Create: `D:\NEOCORTICA-WEB\src\types.ts`

- [ ] **Step 1: Write `types.ts`**

Create `D:\NEOCORTICA-WEB\src\types.ts`:

```typescript
export interface WebMeta {
  url: string;
  normalizedUrl: string;
  title?: string;
  description?: string;
  snippet?: string;
  markdownPath?: string;
  fetchFailed?: boolean;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd D:/NEOCORTICA-WEB && npx tsx -e "import { type WebMeta } from './src/types.js'; console.log('types OK')"
```

Expected: `types OK`

- [ ] **Step 3: Commit**

```bash
cd D:/NEOCORTICA-WEB && git add src/types.ts && git commit -m "feat: add WebMeta type definition"
```

---

### Task 3: utils/misc.ts + tests (normUrl)

**Files:**
- Create: `D:\NEOCORTICA-WEB\src\utils\misc.ts`
- Test: `D:\NEOCORTICA-WEB\.test\utils\misc.test.ts`

- [ ] **Step 1: Write the tests first**

Create `D:\NEOCORTICA-WEB\.test\utils\misc.test.ts`:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normUrl } from "../../src/utils/misc.js";

describe("normUrl", () => {
  // Protocol stripping
  it("strips https protocol", () => {
    assert.equal(normUrl("https://github.com/foo/bar"), "github_com_foo_bar");
  });

  it("strips http protocol", () => {
    assert.equal(normUrl("http://github.com/foo/bar"), "github_com_foo_bar");
  });

  // Query params and fragments
  it("strips query parameters", () => {
    assert.equal(normUrl("https://example.com/path?q=test&lang=en"), "example_com_path");
  });

  it("strips fragment", () => {
    assert.equal(normUrl("https://example.com/page#section"), "example_com_page");
  });

  it("strips both query and fragment", () => {
    assert.equal(normUrl("https://example.com/path?q=test#section"), "example_com_path");
  });

  // Trailing slash
  it("strips trailing slash", () => {
    assert.equal(normUrl("https://example.com/path/"), "example_com_path");
  });

  // Lowercasing
  it("lowercases the URL", () => {
    assert.equal(normUrl("https://GitHub.COM/Foo/Bar"), "github_com_foo_bar");
  });

  // Non-alphanumeric replacement
  it("replaces dots and slashes with underscores", () => {
    assert.equal(normUrl("https://arxiv.org/html/2503.12434v1"), "arxiv_org_html_2503_12434v1");
  });

  // Collapse multiple underscores
  it("collapses multiple underscores", () => {
    assert.equal(normUrl("https://example.com/a---b///c"), "example_com_a_b_c");
  });

  // Strip leading/trailing underscores
  it("strips leading and trailing underscores", () => {
    assert.equal(normUrl("https:///example.com/"), "example_com");
  });

  // Realistic URLs
  it("normalizes a GitHub repo URL", () => {
    assert.equal(normUrl("https://github.com/anthropics/claude-code"), "github_com_anthropics_claude_code");
  });

  it("normalizes an arXiv HTML URL", () => {
    assert.equal(normUrl("https://arxiv.org/html/2503.12434v1"), "arxiv_org_html_2503_12434v1");
  });

  it("normalizes a Wikipedia URL with query", () => {
    assert.equal(
      normUrl("https://en.wikipedia.org/wiki/Large_language_model?oldid=123"),
      "en_wikipedia_org_wiki_large_language_model",
    );
  });

  it("normalizes a complex blog URL", () => {
    assert.equal(
      normUrl("https://blog.example.com/2024/01/my-post?utm_source=twitter#comments"),
      "blog_example_com_2024_01_my_post",
    );
  });

  // Edge cases
  it("handles URL without protocol", () => {
    assert.equal(normUrl("example.com/path"), "example_com_path");
  });

  it("returns empty string for empty input", () => {
    assert.equal(normUrl(""), "");
  });

  it("handles URL with only protocol", () => {
    assert.equal(normUrl("https://"), "");
  });

  // Dedup guarantee
  it("same URL with/without trailing slash produces same result", () => {
    assert.equal(
      normUrl("https://example.com/path"),
      normUrl("https://example.com/path/"),
    );
  });

  it("same URL with/without protocol produces same result", () => {
    assert.equal(
      normUrl("https://example.com/path"),
      normUrl("http://example.com/path"),
    );
  });

  it("same URL with/without query produces same result", () => {
    assert.equal(
      normUrl("https://example.com/path"),
      normUrl("https://example.com/path?q=test"),
    );
  });
});
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
cd D:/NEOCORTICA-WEB && npx tsx --test .test/utils/misc.test.ts
```

Expected: FAIL — `normUrl` not found.

- [ ] **Step 3: Write `misc.ts`**

Create `D:\NEOCORTICA-WEB\src\utils\misc.ts`:

```typescript
/** Normalize a URL into a safe, dedup-friendly cache key. */
export function normUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, "")  // strip protocol
    .replace(/[?#].*$/, "")       // strip query params and fragment
    .replace(/\/+$/, "")          // strip trailing slashes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")  // non-alphanum → _
    .replace(/_+/g, "_")          // collapse multiple _
    .replace(/^_|_$/g, "");       // strip leading/trailing _
}
```

- [ ] **Step 4: Run tests — verify they PASS**

```bash
cd D:/NEOCORTICA-WEB && npx tsx --test .test/utils/misc.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd D:/NEOCORTICA-WEB && git add src/utils/misc.ts .test/utils/misc.test.ts && git commit -m "feat: add normUrl utility with tests"
```

---

### Task 4: utils/cache.ts + tests

**Files:**
- Create: `D:\NEOCORTICA-WEB\src\utils\cache.ts`
- Test: `D:\NEOCORTICA-WEB\.test\utils\cache.test.ts`

- [ ] **Step 1: Write the tests first**

Create `D:\NEOCORTICA-WEB\.test\utils\cache.test.ts`:

```typescript
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, unlinkSync } from "fs";
import { resolve } from "path";
import "dotenv/config";
import { saveMarkdown, saveMeta, loadMeta, loadMarkdownPath } from "../../src/utils/cache.js";
import type { WebMeta } from "../../src/types.js";

const cacheDir = process.env.NEOCORTICA_CACHE || ".cache";

function cleanupTestFiles(normalizedUrls: string[]) {
  for (const nu of normalizedUrls) {
    const mdPath = resolve(cacheDir, "web", `${nu}.md`);
    const metaPath = resolve(cacheDir, "web", `${nu}.json`);
    try { unlinkSync(mdPath); } catch {}
    try { unlinkSync(metaPath); } catch {}
  }
}

describe("cache", () => {
  const testUrls: string[] = [];

  afterEach(() => {
    cleanupTestFiles(testUrls);
    testUrls.length = 0;
  });

  // ── saveMarkdown ──────────────────────────────────────────────

  describe("saveMarkdown", () => {
    it("saves markdown and returns absolute path", () => {
      testUrls.push("zztest_example_com_page");
      const path = saveMarkdown("zztest_example_com_page", "# Hello World");
      assert.ok(path.endsWith(".md"));
      assert.ok(existsSync(path));
      assert.equal(readFileSync(path, "utf-8"), "# Hello World");
    });

    it("overwrites existing file", () => {
      testUrls.push("zztest_overwrite_md");
      saveMarkdown("zztest_overwrite_md", "version 1");
      const path = saveMarkdown("zztest_overwrite_md", "version 2");
      assert.equal(readFileSync(path, "utf-8"), "version 2");
    });

    it("handles large markdown content", () => {
      testUrls.push("zztest_big_page");
      const bigContent = "# Page\n" + "Lorem ipsum dolor. ".repeat(10000);
      const path = saveMarkdown("zztest_big_page", bigContent);
      assert.equal(readFileSync(path, "utf-8"), bigContent);
    });

    it("handles unicode content", () => {
      testUrls.push("zztest_unicode_page");
      const content = "# 网页标题\n\nMathematical: ∑∫∂";
      const path = saveMarkdown("zztest_unicode_page", content);
      assert.equal(readFileSync(path, "utf-8"), content);
    });
  });

  // ── saveMeta / loadMeta ───────────────────────────────────────

  describe("saveMeta + loadMeta", () => {
    it("round-trips full WebMeta with all fields", () => {
      testUrls.push("zztest_github_com_full");
      const fullMeta: WebMeta = {
        url: "https://github.com/full",
        normalizedUrl: "zztest_github_com_full",
        title: "GitHub Full Page",
        description: "A full page description",
        snippet: "Some snippet text...",
        markdownPath: "/some/path/to/page.md",
      };
      saveMeta(fullMeta);
      const loaded = loadMeta("zztest_github_com_full");
      assert.deepEqual(loaded, fullMeta);
    });

    it("round-trips minimal WebMeta", () => {
      testUrls.push("zztest_minimal_page");
      const minimal: WebMeta = {
        url: "https://example.com/minimal",
        normalizedUrl: "zztest_minimal_page",
      };
      saveMeta(minimal);
      const loaded = loadMeta("zztest_minimal_page");
      assert.deepEqual(loaded, minimal);
    });

    it("round-trips WebMeta with fetchFailed=true", () => {
      testUrls.push("zztest_failed_page");
      const failed: WebMeta = {
        url: "https://blocked.com/page",
        normalizedUrl: "zztest_failed_page",
        fetchFailed: true,
      };
      saveMeta(failed);
      const loaded = loadMeta("zztest_failed_page");
      assert.deepEqual(loaded, failed);
      assert.equal(loaded?.fetchFailed, true);
    });

    it("returns null for nonexistent meta", () => {
      assert.equal(loadMeta("zztest_does_not_exist_99999"), null);
    });

    it("overwrites existing meta", () => {
      testUrls.push("zztest_overwrite_meta");
      const v1: WebMeta = { url: "https://example.com/v1", normalizedUrl: "zztest_overwrite_meta", title: "V1" };
      const v2: WebMeta = { url: "https://example.com/v1", normalizedUrl: "zztest_overwrite_meta", title: "V2" };
      saveMeta(v1);
      saveMeta(v2);
      const loaded = loadMeta("zztest_overwrite_meta");
      assert.equal(loaded?.title, "V2");
    });
  });

  // ── loadMarkdownPath ──────────────────────────────────────────

  describe("loadMarkdownPath", () => {
    it("returns path when markdown exists", () => {
      testUrls.push("zztest_cached_page");
      const saved = saveMarkdown("zztest_cached_page", "# content");
      const found = loadMarkdownPath("zztest_cached_page");
      assert.equal(found, saved);
    });

    it("returns null when markdown does not exist", () => {
      assert.equal(loadMarkdownPath("zztest_nonexistent_99999"), null);
    });
  });

  // ── Simulation: realistic workflow ────────────────────────────

  describe("simulation: web search → cache workflow", () => {
    it("simulates caching 4 web pages from a Brave search", () => {
      const urls = [
        "zztest_sim_github_com_anthropics",
        "zztest_sim_blog_example_com_post",
        "zztest_sim_docs_python_org_tutorial",
        "zztest_sim_en_wikipedia_org_llm",
      ];
      testUrls.push(...urls);

      const pages: WebMeta[] = [
        {
          url: "https://github.com/anthropics/claude-code",
          normalizedUrl: "zztest_sim_github_com_anthropics",
          title: "anthropics/claude-code",
          description: "Claude Code CLI",
          snippet: "An AI-powered CLI for software development...",
        },
        {
          url: "https://blog.example.com/post/llm-guide",
          normalizedUrl: "zztest_sim_blog_example_com_post",
          title: "LLM Guide",
          snippet: "A comprehensive guide to large language models...",
        },
        {
          url: "https://docs.python.org/3/tutorial/",
          normalizedUrl: "zztest_sim_docs_python_org_tutorial",
          title: "Python Tutorial",
          description: "Official Python tutorial",
        },
        {
          url: "https://en.wikipedia.org/wiki/Large_language_model",
          normalizedUrl: "zztest_sim_en_wikipedia_org_llm",
          title: "Large language model - Wikipedia",
          fetchFailed: true,
        },
      ];

      // Save all meta (including failed one)
      for (const p of pages) saveMeta(p);

      // Save markdown for 2 (simulating successful fetch)
      saveMarkdown(pages[0].normalizedUrl, "# Claude Code\n\nAn AI-powered CLI...");
      saveMarkdown(pages[2].normalizedUrl, "# Python Tutorial\n\nThe Python tutorial...");

      // Verify all meta loadable
      for (const p of pages) {
        const loaded = loadMeta(p.normalizedUrl);
        assert.ok(loaded, `Meta for "${p.url}" should be loadable`);
        assert.equal(loaded.url, p.url);
      }

      // Verify only 2 have cached markdown
      assert.ok(loadMarkdownPath("zztest_sim_github_com_anthropics"));
      assert.equal(loadMarkdownPath("zztest_sim_blog_example_com_post"), null);
      assert.ok(loadMarkdownPath("zztest_sim_docs_python_org_tutorial"));
      assert.equal(loadMarkdownPath("zztest_sim_en_wikipedia_org_llm"), null);

      // Verify failed page meta has fetchFailed
      const failedMeta = loadMeta("zztest_sim_en_wikipedia_org_llm");
      assert.equal(failedMeta?.fetchFailed, true);
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
cd D:/NEOCORTICA-WEB && npx tsx --test .test/utils/cache.test.ts
```

Expected: FAIL — `cache.js` not found.

- [ ] **Step 3: Write `cache.ts`**

Create `D:\NEOCORTICA-WEB\src\utils\cache.ts`:

```typescript
import { resolve } from "path";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import type { WebMeta } from "../types.js";

function cacheDir(): string {
  return resolve(process.env.NEOCORTICA_CACHE || ".cache");
}

/** Ensure CACHE/web/ directory exists. Returns the web cache path. */
export function ensureDirs(): string {
  const web = resolve(cacheDir(), "web");
  mkdirSync(web, { recursive: true });
  return web;
}

/** Save markdown content to CACHE/web/{normalizedUrl}.md. Returns absolute path. */
export function saveMarkdown(normalizedUrl: string, markdown: string): string {
  const dir = ensureDirs();
  const filePath = resolve(dir, normalizedUrl + ".md");
  writeFileSync(filePath, markdown, "utf-8");
  return filePath;
}

/** Save web page metadata JSON to CACHE/web/{normalizedUrl}.json. */
export function saveMeta(meta: WebMeta): string {
  const dir = ensureDirs();
  const filePath = resolve(dir, meta.normalizedUrl + ".json");
  writeFileSync(filePath, JSON.stringify(meta, null, 2), "utf-8");
  return filePath;
}

/** Load web page metadata from cache. Returns null if not found. */
export function loadMeta(normalizedUrl: string): WebMeta | null {
  const dir = ensureDirs();
  const filePath = resolve(dir, normalizedUrl + ".json");
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

/** Check if markdown is cached. Returns path or null. */
export function loadMarkdownPath(normalizedUrl: string): string | null {
  const dir = ensureDirs();
  const filePath = resolve(dir, normalizedUrl + ".md");
  return existsSync(filePath) ? filePath : null;
}
```

- [ ] **Step 4: Run tests — verify they PASS**

```bash
cd D:/NEOCORTICA-WEB && npx tsx --test .test/utils/cache.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Run ALL tests so far**

```bash
cd D:/NEOCORTICA-WEB && npx tsx --test .test/**/*.test.ts
```

Expected: ALL PASS (misc + cache)

- [ ] **Step 6: Commit**

```bash
cd D:/NEOCORTICA-WEB && git add src/utils/cache.ts src/types.ts .test/utils/cache.test.ts && git commit -m "feat: add cache utility with tests"
```

---

### Task 5: utils/apify.ts + tests (Apify REST API client)

**Files:**
- Create: `D:\NEOCORTICA-WEB\src\utils\apify.ts`
- Test: `D:\NEOCORTICA-WEB\.test\utils\apify.test.ts`

**Context:** This util wraps three Apify REST API operations using native `fetch`. The tests use `globalThis.fetch` mocking to simulate realistic Apify API responses without network calls.

- [ ] **Step 1: Write the tests first**

Create `D:\NEOCORTICA-WEB\.test\utils\apify.test.ts`:

```typescript
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { runActor, waitForRun, getDatasetItems } from "../../src/utils/apify.js";

// Save original fetch to restore after tests
const originalFetch = globalThis.fetch;

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = handler as any;
}

describe("apify", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── runActor ──────────────────────────────────────────────────

  describe("runActor", () => {
    it("starts an actor run and returns run info", async () => {
      mockFetch(async (url, init) => {
        assert.ok(url.includes("/v2/acts/apify~rag-web-browser/runs"));
        assert.equal(init?.method, "POST");
        const headers = init?.headers as Record<string, string>;
        assert.ok(headers?.["Authorization"]?.includes("Bearer test-token"));
        const body = JSON.parse(init?.body as string);
        assert.equal(body.query, "https://example.com");
        return new Response(JSON.stringify({
          data: {
            id: "run-123",
            status: "READY",
            defaultDatasetId: "ds-456",
          },
        }), { status: 201 });
      });

      const result = await runActor(
        "apify~rag-web-browser",
        { query: "https://example.com", maxResults: 1, outputFormats: ["markdown"] },
        "test-token",
      );
      assert.equal(result.id, "run-123");
      assert.equal(result.status, "READY");
      assert.equal(result.defaultDatasetId, "ds-456");
    });

    it("throws on non-2xx response", async () => {
      mockFetch(async () => new Response("Unauthorized", { status: 401 }));
      await assert.rejects(
        () => runActor("apify~rag-web-browser", {}, "bad-token"),
        { message: /401/ },
      );
    });
  });

  // ── waitForRun ────────────────────────────────────────────────

  describe("waitForRun", () => {
    it("returns immediately when run already SUCCEEDED", async () => {
      mockFetch(async () => new Response(JSON.stringify({
        data: { id: "run-123", status: "SUCCEEDED", defaultDatasetId: "ds-456" },
      })));

      const result = await waitForRun("run-123", "test-token", undefined, 100, 5000);
      assert.equal(result.status, "SUCCEEDED");
    });

    it("polls until SUCCEEDED", async () => {
      let callCount = 0;
      mockFetch(async () => {
        callCount++;
        const status = callCount >= 3 ? "SUCCEEDED" : "RUNNING";
        return new Response(JSON.stringify({
          data: { id: "run-123", status, defaultDatasetId: "ds-456" },
        }));
      });

      const result = await waitForRun("run-123", "test-token", undefined, 50, 5000);
      assert.equal(result.status, "SUCCEEDED");
      assert.ok(callCount >= 3);
    });

    it("throws on FAILED status", async () => {
      mockFetch(async () => new Response(JSON.stringify({
        data: { id: "run-123", status: "FAILED", defaultDatasetId: "ds-456" },
      })));

      await assert.rejects(
        () => waitForRun("run-123", "test-token", undefined, 100, 5000),
        { message: /FAILED/ },
      );
    });

    it("throws on ABORTED status", async () => {
      mockFetch(async () => new Response(JSON.stringify({
        data: { id: "run-123", status: "ABORTED", defaultDatasetId: "ds-456" },
      })));

      await assert.rejects(
        () => waitForRun("run-123", "test-token", undefined, 100, 5000),
        { message: /ABORTED/ },
      );
    });

    it("throws on timeout", async () => {
      mockFetch(async () => new Response(JSON.stringify({
        data: { id: "run-123", status: "RUNNING", defaultDatasetId: "ds-456" },
      })));

      await assert.rejects(
        () => waitForRun("run-123", "test-token", undefined, 50, 200),
        { message: /timeout/i },
      );
    });
  });

  // ── getDatasetItems ───────────────────────────────────────────

  describe("getDatasetItems", () => {
    it("returns dataset items array", async () => {
      const fakeItems = [
        {
          crawl: { httpStatusCode: 200 },
          metadata: { title: "Example Page", description: "A test page" },
          markdown: "# Example\n\nThis is the page content.",
        },
      ];
      mockFetch(async (url) => {
        assert.ok(url.includes("/v2/datasets/ds-456/items"));
        return new Response(JSON.stringify(fakeItems));
      });

      const items = await getDatasetItems("ds-456", "test-token");
      assert.equal(items.length, 1);
      assert.equal(items[0].markdown, "# Example\n\nThis is the page content.");
      assert.equal(items[0].metadata.title, "Example Page");
    });

    it("returns empty array for empty dataset", async () => {
      mockFetch(async () => new Response(JSON.stringify([])));
      const items = await getDatasetItems("ds-empty", "test-token");
      assert.equal(items.length, 0);
    });

    it("throws on non-2xx response", async () => {
      mockFetch(async () => new Response("Not Found", { status: 404 }));
      await assert.rejects(
        () => getDatasetItems("ds-bad", "test-token"),
        { message: /404/ },
      );
    });
  });

  // ── Simulation: full actor lifecycle ──────────────────────────

  describe("simulation: full rag-web-browser lifecycle", () => {
    it("simulates start → poll → get items for a real URL", async () => {
      let phase = "start";
      let pollCount = 0;

      mockFetch(async (url, init) => {
        if (phase === "start" && url.includes("/runs") && init?.method === "POST") {
          phase = "poll";
          return new Response(JSON.stringify({
            data: { id: "run-abc", status: "READY", defaultDatasetId: "ds-xyz" },
          }), { status: 201 });
        }
        if (phase === "poll" && url.includes("/actor-runs/run-abc")) {
          pollCount++;
          const status = pollCount >= 2 ? "SUCCEEDED" : "RUNNING";
          return new Response(JSON.stringify({
            data: { id: "run-abc", status, defaultDatasetId: "ds-xyz" },
          }));
        }
        if (url.includes("/datasets/ds-xyz/items")) {
          return new Response(JSON.stringify([{
            crawl: { httpStatusCode: 200, loadedAt: "2026-03-15T10:00:00Z" },
            metadata: {
              title: "Claude Code - GitHub",
              description: "An AI-powered CLI for software development",
              url: "https://github.com/anthropics/claude-code",
            },
            markdown: "# Claude Code\n\nAn AI-powered command-line interface...",
          }]));
        }
        return new Response("Unexpected request", { status: 500 });
      });

      // Step 1: Start actor
      const run = await runActor(
        "apify~rag-web-browser",
        { query: "https://github.com/anthropics/claude-code", maxResults: 1, outputFormats: ["markdown"] },
        "test-token",
      );
      assert.equal(run.id, "run-abc");

      // Step 2: Poll until done
      const completed = await waitForRun(run.id, "test-token", undefined, 50, 5000);
      assert.equal(completed.status, "SUCCEEDED");

      // Step 3: Get items
      const items = await getDatasetItems(completed.defaultDatasetId, "test-token");
      assert.equal(items.length, 1);
      assert.ok(items[0].markdown.includes("Claude Code"));
      assert.equal(items[0].metadata.title, "Claude Code - GitHub");
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
cd D:/NEOCORTICA-WEB && npx tsx --test .test/utils/apify.test.ts
```

Expected: FAIL — `apify.js` not found.

- [ ] **Step 3: Write `apify.ts`**

Create `D:\NEOCORTICA-WEB\src\utils\apify.ts`:

```typescript
const APIFY_BASE = "https://api.apify.com/v2";

export interface ActorRunResult {
  id: string;
  status: string;
  defaultDatasetId: string;
}

export type ProgressCallback = (info: { message: string }) => void | Promise<void>;

/** Start an Apify actor run. */
export async function runActor(
  actorId: string,
  input: Record<string, any>,
  token: string,
  onProgress?: ProgressCallback,
): Promise<ActorRunResult> {
  onProgress?.({ message: `Starting actor ${actorId}` });

  const res = await fetch(`${APIFY_BASE}/acts/${actorId}/runs`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(`Apify runActor failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json() as { data: ActorRunResult };
  return json.data;
}

/** Poll an actor run until it completes. */
export async function waitForRun(
  runId: string,
  token: string,
  onProgress?: ProgressCallback,
  pollInterval = 3000,
  timeout = 120000,
): Promise<ActorRunResult> {
  const start = Date.now();

  while (true) {
    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Apify waitForRun failed: ${res.status} ${res.statusText}`);
    }

    const json = await res.json() as { data: ActorRunResult };
    const { status } = json.data;

    if (status === "SUCCEEDED") return json.data;
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify run ${runId} ${status}`);
    }

    if (Date.now() - start > timeout) {
      throw new Error(`Apify run ${runId} timeout after ${timeout}ms`);
    }

    onProgress?.({ message: `Waiting for run ${runId}: ${status}` });
    await new Promise((r) => setTimeout(r, pollInterval));
  }
}

/** Get dataset items from a completed run. */
export async function getDatasetItems(
  datasetId: string,
  token: string,
): Promise<any[]> {
  const res = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items`, {
    headers: { "Authorization": `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Apify getDatasetItems failed: ${res.status} ${res.statusText}`);
  }

  return await res.json() as any[];
}
```

- [ ] **Step 4: Run tests — verify they PASS**

```bash
cd D:/NEOCORTICA-WEB && npx tsx --test .test/utils/apify.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Run ALL tests so far**

```bash
cd D:/NEOCORTICA-WEB && npx tsx --test .test/**/*.test.ts
```

Expected: ALL PASS (misc + cache + apify)

- [ ] **Step 6: Commit**

```bash
cd D:/NEOCORTICA-WEB && git add src/utils/apify.ts .test/utils/apify.test.ts && git commit -m "feat: add Apify REST API client with simulation tests"
```

---

## Chunk 2: Tools + MCP Server

### Task 6: tools/web_fetching.ts + tests

**Files:**
- Create: `D:\NEOCORTICA-WEB\src\tools\web_fetching.ts`
- Test: `D:\NEOCORTICA-WEB\.test\tools\web_fetching.test.ts`

**Context:** `webFetching()` is the main tool function. It checks cache first, then calls Apify rag-web-browser via the apify.ts util, saves results, returns WebMeta. Tests mock the apify util module using a dependency injection pattern — the function accepts an optional `apifyClient` override for testing.

- [ ] **Step 1: Write the tests first**

Create `D:\NEOCORTICA-WEB\.test\tools\web_fetching.test.ts`:

```typescript
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { unlinkSync } from "fs";
import { resolve } from "path";
import "dotenv/config";
import { webFetching } from "../../src/tools/web_fetching.js";
import type { WebMeta } from "../../src/types.js";
import type { ApifyClient } from "../../src/utils/apify.js";

const cacheDir = process.env.NEOCORTICA_CACHE || ".cache";

function cleanupTestFiles(normalizedUrls: string[]) {
  for (const nu of normalizedUrls) {
    const mdPath = resolve(cacheDir, "web", `${nu}.md`);
    const metaPath = resolve(cacheDir, "web", `${nu}.json`);
    try { unlinkSync(mdPath); } catch {}
    try { unlinkSync(metaPath); } catch {}
  }
}

/** Create a fake ApifyClient that returns preset markdown content. */
function fakeApifyClient(markdown: string, title?: string, description?: string): ApifyClient {
  return {
    async runActor() {
      return { id: "run-test", status: "READY", defaultDatasetId: "ds-test" };
    },
    async waitForRun() {
      return { id: "run-test", status: "SUCCEEDED", defaultDatasetId: "ds-test" };
    },
    async getDatasetItems() {
      return [{
        metadata: { title: title ?? "Test Page", description: description ?? "A test page" },
        markdown,
      }];
    },
  };
}

/** Create a fake ApifyClient that always fails. */
function failingApifyClient(errorMessage?: string): ApifyClient {
  return {
    async runActor() {
      throw new Error(errorMessage ?? "Apify actor failed");
    },
    async waitForRun() {
      throw new Error("should not be called");
    },
    async getDatasetItems() {
      throw new Error("should not be called");
    },
  };
}

/** Create a fake ApifyClient that returns empty results. */
function emptyApifyClient(): ApifyClient {
  return {
    async runActor() {
      return { id: "run-empty", status: "READY", defaultDatasetId: "ds-empty" };
    },
    async waitForRun() {
      return { id: "run-empty", status: "SUCCEEDED", defaultDatasetId: "ds-empty" };
    },
    async getDatasetItems() {
      return [];
    },
  };
}

describe("web_fetching", () => {
  const testUrls: string[] = [];

  afterEach(() => {
    cleanupTestFiles(testUrls);
    testUrls.length = 0;
  });

  it("fetches a page and caches markdown + meta", async () => {
    testUrls.push("zztest_example_com_fetching");
    const result = await webFetching(
      { url: "https://zztest-example.com/fetching", title: "Test Page" },
      fakeApifyClient("# Test Page\n\nSome content here."),
    );
    assert.equal(result.url, "https://zztest-example.com/fetching");
    assert.equal(result.normalizedUrl, "zztest_example_com_fetching");
    assert.ok(result.markdownPath);
    assert.ok(result.markdownPath!.endsWith("zztest_example_com_fetching.md"));
    assert.equal(result.fetchFailed, undefined);
    assert.equal(result.title, "Test Page");
  });

  it("returns cache hit without calling Apify", async () => {
    testUrls.push("zztest_cached_hit_page");
    // First call: populate cache
    await webFetching(
      { url: "https://zztest-cached-hit.page/" },
      fakeApifyClient("# Cached Page"),
    );
    // Second call: should hit cache, not Apify
    const calledApify = { called: false };
    const result = await webFetching(
      { url: "https://zztest-cached-hit.page/" },
      {
        async runActor() { calledApify.called = true; throw new Error("should not call"); },
        async waitForRun() { throw new Error("should not call"); },
        async getDatasetItems() { throw new Error("should not call"); },
      },
    );
    assert.equal(calledApify.called, false);
    assert.ok(result.markdownPath);
  });

  it("returns fetchFailed=true when Apify fails", async () => {
    testUrls.push("zztest_failing_page");
    const result = await webFetching(
      { url: "https://zztest-failing.page/" },
      failingApifyClient("anti-scrape blocked"),
    );
    assert.equal(result.fetchFailed, true);
    assert.equal(result.markdownPath, undefined);
  });

  it("returns fetchFailed=true when Apify returns empty results", async () => {
    testUrls.push("zztest_empty_result_page");
    const result = await webFetching(
      { url: "https://zztest-empty-result.page/" },
      emptyApifyClient(),
    );
    assert.equal(result.fetchFailed, true);
  });

  it("returns cached fetchFailed meta on second call (no retry)", async () => {
    testUrls.push("zztest_cached_fail_page");
    // First call: fails
    await webFetching(
      { url: "https://zztest-cached-fail.page/" },
      failingApifyClient(),
    );
    // Second call: should return cached failure
    const result = await webFetching(
      { url: "https://zztest-cached-fail.page/" },
      failingApifyClient("should not be called"),
    );
    assert.equal(result.fetchFailed, true);
  });

  it("extracts title from Apify response when not provided", async () => {
    testUrls.push("zztest_auto_title_page");
    const result = await webFetching(
      { url: "https://zztest-auto-title.page/" },
      fakeApifyClient("# Content", "Auto Discovered Title", "Page desc"),
    );
    assert.equal(result.title, "Auto Discovered Title");
    assert.equal(result.description, "Page desc");
  });

  it("prefers user-provided title over Apify response", async () => {
    testUrls.push("zztest_user_title_page");
    const result = await webFetching(
      { url: "https://zztest-user-title.page/", title: "User Provided" },
      fakeApifyClient("# Content", "Apify Title"),
    );
    assert.equal(result.title, "User Provided");
  });

  // ── Simulation ────────────────────────────────────────────────

  describe("simulation: batch fetch of 3 URLs from a Brave search", () => {
    it("processes 3 URLs sequentially, 2 succeed, 1 fails", async () => {
      const urls = [
        "zztest_batch_github_com_repo",
        "zztest_batch_blog_com_post",
        "zztest_batch_blocked_com_page",
      ];
      testUrls.push(...urls);

      const clients: Record<string, ApifyClient> = {
        "https://zztest-batch-github.com/repo": fakeApifyClient("# GitHub Repo\n\nREADME content", "GitHub Repo"),
        "https://zztest-batch-blog.com/post": fakeApifyClient("# Blog Post\n\nGreat article", "Blog Post"),
        "https://zztest-batch-blocked.com/page": failingApifyClient("403 Forbidden"),
      };

      const results: WebMeta[] = [];
      for (const [url, client] of Object.entries(clients)) {
        results.push(await webFetching({ url }, client));
      }

      // 2 succeeded
      assert.ok(results[0].markdownPath);
      assert.equal(results[0].title, "GitHub Repo");
      assert.ok(results[1].markdownPath);
      assert.equal(results[1].title, "Blog Post");

      // 1 failed
      assert.equal(results[2].fetchFailed, true);
      assert.equal(results[2].markdownPath, undefined);
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
cd D:/NEOCORTICA-WEB && npx tsx --test .test/tools/web_fetching.test.ts
```

Expected: FAIL — `web_fetching.js` not found.

- [ ] **Step 3: Update `apify.ts` to export `ApifyClient` interface**

Add the `ApifyClient` interface to `D:\NEOCORTICA-WEB\src\utils\apify.ts` — append after the existing `getDatasetItems` function:

```typescript
/** Injectable client interface for testing. */
export interface ApifyClient {
  runActor(actorId: string, input: Record<string, any>, token: string, onProgress?: ProgressCallback): Promise<ActorRunResult>;
  waitForRun(runId: string, token: string, onProgress?: ProgressCallback, pollInterval?: number, timeout?: number): Promise<ActorRunResult>;
  getDatasetItems(datasetId: string, token: string): Promise<any[]>;
}

/** Default client using the real Apify REST API. */
export const defaultApifyClient: ApifyClient = {
  runActor,
  waitForRun,
  getDatasetItems,
};
```

- [ ] **Step 4: Write `web_fetching.ts`**

Create `D:\NEOCORTICA-WEB\src\tools\web_fetching.ts`:

```typescript
import type { WebMeta } from "../types.js";
import { normUrl } from "../utils/misc.js";
import * as cache from "../utils/cache.js";
import { defaultApifyClient, type ApifyClient, type ProgressCallback } from "../utils/apify.js";

export interface WebFetchingInput {
  url: string;
  title?: string;
}

/**
 * web_fetching tool: fetch a web page as markdown via Apify rag-web-browser.
 * Cache-first: checks local cache (including cached failures) before network calls.
 */
export async function webFetching(
  input: WebFetchingInput,
  client: ApifyClient = defaultApifyClient,
  onProgress?: ProgressCallback,
): Promise<WebMeta> {
  const normalizedUrl = normUrl(input.url);

  // 1. Check cache — markdown file exists (success cache)
  const cachedPath = cache.loadMarkdownPath(normalizedUrl);
  if (cachedPath) {
    const meta = cache.loadMeta(normalizedUrl);
    if (meta) {
      meta.markdownPath = cachedPath;
      return meta;
    }
    return { url: input.url, normalizedUrl, markdownPath: cachedPath, title: input.title };
  }

  // 2. Check cache — meta JSON exists with fetchFailed (failure cache)
  const cachedMeta = cache.loadMeta(normalizedUrl);
  if (cachedMeta?.fetchFailed) {
    return cachedMeta;
  }

  // 3. Call Apify rag-web-browser
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN environment variable not set");

  const meta: WebMeta = {
    url: input.url,
    normalizedUrl,
    title: input.title,
  };

  try {
    onProgress?.({ message: `Fetching ${input.url} via Apify rag-web-browser` });

    const run = await client.runActor(
      "apify~rag-web-browser",
      { query: input.url, maxResults: 1, outputFormats: ["markdown"] },
      token,
      onProgress,
    );

    const completed = await client.waitForRun(run.id, token, onProgress);
    const items = await client.getDatasetItems(completed.defaultDatasetId, token);

    if (!items.length || !items[0].markdown) {
      meta.fetchFailed = true;
      cache.saveMeta(meta);
      return meta;
    }

    const item = items[0];
    const markdown = item.markdown as string;

    // Extract metadata from Apify response (user-provided title takes priority)
    if (!meta.title && item.metadata?.title) meta.title = item.metadata.title;
    if (item.metadata?.description) meta.description = item.metadata.description;

    // Save to cache
    meta.markdownPath = cache.saveMarkdown(normalizedUrl, markdown);
    cache.saveMeta(meta);
    return meta;

  } catch (e: any) {
    onProgress?.({ message: `Fetch failed for ${input.url}: ${e.message}` });
    meta.fetchFailed = true;
    cache.saveMeta(meta);
    return meta;
  }
}
```

- [ ] **Step 5: Run web_fetching tests — verify they PASS**

```bash
cd D:/NEOCORTICA-WEB && npx tsx --test .test/tools/web_fetching.test.ts
```

Expected: ALL PASS

- [ ] **Step 6: Run ALL tests**

```bash
cd D:/NEOCORTICA-WEB && npx tsx --test .test/**/*.test.ts
```

Expected: ALL PASS (misc + cache + apify + web_fetching)

- [ ] **Step 7: Commit**

```bash
cd D:/NEOCORTICA-WEB && git add src/tools/web_fetching.ts src/utils/apify.ts .test/tools/web_fetching.test.ts && git commit -m "feat: add web_fetching tool with simulation tests"
```

---

### Task 7: tools/web_content.ts + tests

**Files:**
- Create: `D:\NEOCORTICA-WEB\src\tools\web_content.ts`
- Test: `D:\NEOCORTICA-WEB\.test\tools\web_content.test.ts`

- [ ] **Step 1: Write the tests first**

Create `D:\NEOCORTICA-WEB\.test\tools\web_content.test.ts`:

```typescript
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { unlinkSync } from "fs";
import { resolve } from "path";
import "dotenv/config";
import { webContent } from "../../src/tools/web_content.js";
import { saveMarkdown } from "../../src/utils/cache.js";

const cacheDir = process.env.NEOCORTICA_CACHE || ".cache";

function cleanupTestFiles(normalizedUrls: string[]) {
  for (const nu of normalizedUrls) {
    const mdPath = resolve(cacheDir, "web", `${nu}.md`);
    try { unlinkSync(mdPath); } catch {}
  }
}

describe("web_content", () => {
  const testUrls: string[] = [];

  afterEach(() => {
    cleanupTestFiles(testUrls);
    testUrls.length = 0;
  });

  it("returns content by normalizedUrl", () => {
    testUrls.push("zztest_content_example_com");
    saveMarkdown("zztest_content_example_com", "# Example\n\nPage content here.");
    const result = webContent({ normalizedUrl: "zztest_content_example_com" });
    assert.ok(result);
    assert.equal(result!.content, "# Example\n\nPage content here.");
  });

  it("derives normalizedUrl from url", () => {
    testUrls.push("zztest_content_github_com_page");
    saveMarkdown("zztest_content_github_com_page", "# GitHub Page");
    const result = webContent({ url: "https://zztest-content-github.com/page" });
    assert.ok(result);
    assert.equal(result!.content, "# GitHub Page");
  });

  it("returns null when page not cached", () => {
    const result = webContent({ normalizedUrl: "zztest_nonexistent_99999" });
    assert.equal(result, null);
  });

  it("returns null when neither url nor normalizedUrl provided", () => {
    const result = webContent({});
    assert.equal(result, null);
  });

  it("prefers normalizedUrl over url when both provided", () => {
    testUrls.push("zztest_prefer_normalized");
    saveMarkdown("zztest_prefer_normalized", "# Preferred Content");
    const result = webContent({
      url: "https://wrong-url.com/should-not-match",
      normalizedUrl: "zztest_prefer_normalized",
    });
    assert.ok(result);
    assert.equal(result!.content, "# Preferred Content");
  });

  it("handles markdown with unicode content", () => {
    testUrls.push("zztest_unicode_web");
    saveMarkdown("zztest_unicode_web", "# 中文标题\n\n数学公式: ∑∫∂");
    const result = webContent({ normalizedUrl: "zztest_unicode_web" });
    assert.ok(result);
    assert.equal(result!.content, "# 中文标题\n\n数学公式: ∑∫∂");
  });
});
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
cd D:/NEOCORTICA-WEB && npx tsx --test .test/tools/web_content.test.ts
```

Expected: FAIL — `web_content.js` not found.

- [ ] **Step 3: Write `web_content.ts`**

Create `D:\NEOCORTICA-WEB\src\tools\web_content.ts`:

```typescript
import { readFileSync } from "fs";
import { normUrl } from "../utils/misc.js";
import { loadMarkdownPath } from "../utils/cache.js";

export interface WebContentQuery {
  url?: string;
  normalizedUrl?: string;
}

export interface WebContentResult {
  content: string;
  markdownPath: string;
}

/** Read cached web page markdown. Pure local, no network. */
export function webContent(query: WebContentQuery): WebContentResult | null {
  const nu = query.normalizedUrl ?? (query.url ? normUrl(query.url) : "");
  if (!nu) return null;

  const markdownPath = loadMarkdownPath(nu);
  if (!markdownPath) return null;

  const content = readFileSync(markdownPath, "utf-8");
  return { content, markdownPath };
}
```

- [ ] **Step 4: Run web_content tests — verify they PASS**

```bash
cd D:/NEOCORTICA-WEB && npx tsx --test .test/tools/web_content.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Run ALL tests**

```bash
cd D:/NEOCORTICA-WEB && npx tsx --test .test/**/*.test.ts
```

Expected: ALL PASS (misc + cache + apify + web_fetching + web_content)

- [ ] **Step 6: Commit**

```bash
cd D:/NEOCORTICA-WEB && git add src/tools/web_content.ts .test/tools/web_content.test.ts && git commit -m "feat: add web_content tool with tests"
```

---

### Task 8: mcp_server.ts

**Files:**
- Create: `D:\NEOCORTICA-WEB\src\mcp_server.ts`

- [ ] **Step 1: Write `mcp_server.ts`**

Create `D:\NEOCORTICA-WEB\src\mcp_server.ts`:

```typescript
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { webFetching } from "./tools/web_fetching.js";
import { webContent } from "./tools/web_content.js";
import type { ProgressCallback } from "./utils/apify.js";

const server = new McpServer({
  name: "neocortica-web",
  version: "0.1.0",
});

// ── Helper ───────────────────────────────────────────────────────

function makeProgress(extra: any): ProgressCallback {
  return async (info) => {
    try { await server.sendLoggingMessage({ level: "info", data: info.message }); } catch {}
  };
}

// ── Tool 1: web_fetching ─────────────────────────────────────────

server.tool(
  "web_fetching",
  "Fetch web page as markdown and cache locally. " +
  "Uses Apify rag-web-browser REST API. Cache-first: returns instantly if already cached. " +
  "Returns WebMeta with markdownPath on success, fetchFailed on failure.",
  {
    url: z.string().describe("URL to fetch"),
    title: z.string().optional().describe("Page title if known (e.g., from Brave search results)"),
  },
  async (args, extra: any) => {
    try {
      const result = await webFetching(args, undefined, makeProgress(extra));
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text" as const, text: `web_fetching failed: ${e.message}` }] };
    }
  },
);

// ── Tool 2: web_content ──────────────────────────────────────────

server.tool(
  "web_content",
  "Read cached web page markdown (local only, no network). " +
  "Returns page content if cached, error message if not found.",
  {
    url: z.string().optional().describe("Original URL (converted to cache key via normUrl)"),
    normalizedUrl: z.string().optional().describe("Normalized URL for direct cache lookup"),
  },
  async (args) => {
    try {
      const result = webContent(args);
      if (!result) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Page not found in cache." }) }] };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify({ content: result.content }) }] };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text" as const, text: `web_content failed: ${e.message}` }] };
    }
  },
);

// ── Start ────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 2: Verify it compiles**

```bash
cd D:/NEOCORTICA-WEB && npx tsx -e "console.log('compile check')" && echo "OK"
```

(Note: We can't actually start the MCP server in a test since it takes over stdio. Just verify the imports resolve.)

```bash
cd D:/NEOCORTICA-WEB && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Run ALL tests**

```bash
cd D:/NEOCORTICA-WEB && npx tsx --test .test/**/*.test.ts
```

Expected: ALL PASS (nothing broken by adding mcp_server.ts)

- [ ] **Step 4: Commit**

```bash
cd D:/NEOCORTICA-WEB && git add src/mcp_server.ts && git commit -m "feat: add MCP server entry with web_fetching and web_content tools"
```

---

### Task 9: Integration test (real Apify API call)

**Files:**
- Create: `D:\NEOCORTICA-WEB\.test\integration.test.ts`

**Context:** This test makes a REAL Apify API call. It requires a valid `APIFY_TOKEN` in `.env`. It fetches a simple, stable public page. Run separately from unit tests (it's slow and costs Apify credits).

- [ ] **Step 1: Write the integration test**

Create `D:\NEOCORTICA-WEB\.test\integration.test.ts`:

```typescript
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { unlinkSync } from "fs";
import { resolve } from "path";
import "dotenv/config";
import { webFetching } from "../src/tools/web_fetching.js";
import { webContent } from "../src/tools/web_content.js";
import { normUrl } from "../src/utils/misc.js";

const cacheDir = process.env.NEOCORTICA_CACHE || ".cache";

function cleanupTestFiles(normalizedUrls: string[]) {
  for (const nu of normalizedUrls) {
    const mdPath = resolve(cacheDir, "web", `${nu}.md`);
    const metaPath = resolve(cacheDir, "web", `${nu}.json`);
    try { unlinkSync(mdPath); } catch {}
    try { unlinkSync(metaPath); } catch {}
  }
}

describe("integration: real Apify API", () => {
  const testUrls: string[] = [];

  afterEach(() => {
    cleanupTestFiles(testUrls);
    testUrls.length = 0;
  });

  it("fetches a real web page and reads it from cache", { timeout: 120000 }, async () => {
    // Use a simple, stable page (httpbin returns predictable content)
    const url = "https://httpbin.org/html";
    const nu = normUrl(url);
    testUrls.push(nu);

    // Step 1: Fetch via Apify (real API call)
    const meta = await webFetching(
      { url, title: "httpbin HTML page" },
      undefined, // use real Apify client
      (info) => console.log(`  [progress] ${info.message}`),
    );

    assert.equal(meta.url, url);
    assert.equal(meta.normalizedUrl, nu);
    assert.ok(meta.markdownPath, "Should have markdownPath after successful fetch");
    assert.equal(meta.fetchFailed, undefined);

    // Step 2: Read from cache
    const content = webContent({ normalizedUrl: nu });
    assert.ok(content, "Should find page in cache");
    assert.ok(content!.content.length > 50, "Content should have substantial text");

    // Step 3: Second fetch should be cache hit (fast)
    const start = Date.now();
    const cached = await webFetching({ url });
    const elapsed = Date.now() - start;
    assert.ok(cached.markdownPath, "Cached fetch should have markdownPath");
    assert.ok(elapsed < 100, `Cache hit should be fast, was ${elapsed}ms`);
  });
});
```

- [ ] **Step 2: Run the integration test**

```bash
cd D:/NEOCORTICA-WEB && npx tsx --test .test/integration.test.ts
```

Expected: PASS (takes 10-60 seconds for the real Apify API call). If it fails due to network, retry once.

- [ ] **Step 3: Run ALL tests (unit + integration)**

```bash
cd D:/NEOCORTICA-WEB && npx tsx --test .test/**/*.test.ts
```

Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
cd D:/NEOCORTICA-WEB && git add .test/integration.test.ts && git commit -m "test: add integration test with real Apify API call"
```

---

## Chunk 3: Main Repo Updates

### Task 10: Update NEOCORTICA main repo `.mcp.json`

**Files:**
- Modify: `D:\NEOCORTICA\.mcp.json` — add `neocortica-web` entry

- [ ] **Step 1: Add neocortica-web to `.mcp.json`**

Read `D:\NEOCORTICA\.mcp.json`, then add a new `"neocortica-web"` entry alongside the existing servers. The entry should be:

```json
"neocortica-web": {
  "command": "npx",
  "args": ["--prefix", "D:/NEOCORTICA-WEB", "tsx", "D:/NEOCORTICA-WEB/src/mcp_server.ts"],
  "env": {
    "APIFY_TOKEN": "<copy from apify server env>",
    "NEOCORTICA_CACHE": ".cache"
  }
}
```

Copy the `APIFY_TOKEN` value from the existing `apify` server's env block.

- [ ] **Step 2: Verify `.mcp.json` is valid JSON**

```bash
cd D:/NEOCORTICA && node -e "JSON.parse(require('fs').readFileSync('.mcp.json','utf-8')); console.log('Valid JSON')"
```

Expected: `Valid JSON`

- [ ] **Step 3: No commit** (`.mcp.json` is gitignored — local-only config)

---

### Task 11: Migrate web-searching pipeline

**Files:**
- Modify: `D:\NEOCORTICA\pipeline\web-searching.md`

- [ ] **Step 1: Rewrite `web-searching.md`**

Replace the full content of `D:\NEOCORTICA\pipeline\web-searching.md` with:

```markdown
# Web Searching Pipeline (web-searching)

Fixed workflow for searching the web via Brave Search and extracting full page content via neocortica-web MCP.

## Input

- `queries: string[]` — 1-3 search keywords
- `maxResultsPerQuery: number` — default 3
- `urlsVisited: Set<string>` — URLs already processed (for cross-iteration dedup)

## Output

- `WebMeta[]` — web page metadata. Each object contains:
  - `url`, `normalizedUrl`, `title`, `description`, `snippet`
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

For each URL (sequential — Apify compute constraint):

```
web_fetching({ url: url, title: braveResult.title })
```

Returns `WebMeta` with `markdownPath` on success, `fetchFailed: true` on failure. Caching is handled internally by `web_fetching` — no manual Write needed.

## Error Handling

| Failure | Action |
|---|---|
| `brave_web_search` failure | Retry 1x, skip on second failure |
| `web_fetching` failure (anti-scrape/timeout) | Skip, mark `fetchFailed = true` (auto-cached) |
| All extractions fail | Degrade: return WebMeta with Brave snippets only (no markdownPath) |

## Notes

- DISCOVER phase uses Brave Search (fast, independent index, <1s per query) via existing brave-search MCP.
- EXTRACT phase uses neocortica-web's `web_fetching` tool (internally calls Apify rag-web-browser REST API, auto-caches to `CACHE/web/`).
- Sequential EXTRACT processing due to Apify compute constraints. Typical: 16-31s per page.
- Cache path convention: `CACHE/web/{normalizedUrl}.md` (normalized via `normUrl()`).
- To read cached content later: use `web_content({ url })` or `web_content({ normalizedUrl })`.

> **Migration complete** (2026-03-15): Migrated from interim version (direct `rag-web-browser` + manual Write) to neocortica-web MCP tools (`web_fetching` with auto-cache). DISCOVER phase still uses `brave_web_search` via existing brave-search MCP.
```

- [ ] **Step 2: Sync `.claude/commands/web-searching.md`**

```bash
cp D:/NEOCORTICA/pipeline/web-searching.md D:/NEOCORTICA/.claude/commands/web-searching.md
```

- [ ] **Step 3: Commit pipeline migration**

```bash
cd D:/NEOCORTICA && git add pipeline/web-searching.md && git commit -m "feat: migrate web-searching pipeline from interim to neocortica-web tools"
```

---

### Task 12: Create skill/neocortica-web.md

**Files:**
- Create: `D:\NEOCORTICA\skill\neocortica-web.md`

- [ ] **Step 1: Write the skill guide**

Create `D:\NEOCORTICA\skill\neocortica-web.md`:

```markdown
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

**Output**: `{ content: string }` on success, `{ error: "Page not found in cache." }` on miss.

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
```

- [ ] **Step 2: Commit skill guide**

```bash
cd D:/NEOCORTICA && git add skill/neocortica-web.md && git commit -m "docs: add neocortica-web tool usage guide"
```

---

### Task 13: Update CLAUDE.md

**Files:**
- Modify: `D:\NEOCORTICA\CLAUDE.md`

- [ ] **Step 1: Add neocortica-web to the External MCP Servers table**

In `D:\NEOCORTICA\CLAUDE.md`, find the External MCP Servers table and add a new row:

```
| `neocortica-web` | `D:\NEOCORTICA-WEB` | Web page fetching and caching (fetch, read) |
```

- [ ] **Step 2: Add neocortica-web tools to the MCP Tools section**

Add a new subsection after the existing `neocortica-scholar` tools:

```markdown
### neocortica-web (Web Page Pipeline)

| Tool | Description |
| ---- | ----------- |
| `web_fetching` | Fetch web page as markdown via Apify rag-web-browser (cache-first) |
| `web_content` | Read cached web page markdown (local only, no network) |
```

- [ ] **Step 3: No commit** (`CLAUDE.md` is gitignored — local-only config)

---
