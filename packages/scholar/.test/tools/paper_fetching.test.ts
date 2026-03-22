import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from "fs";
import { resolve } from "path";
import "dotenv/config";
import AdmZip from "adm-zip";
import { saveMarkdown, saveMeta, loadMeta } from "../../src/utils/cache.js";
import { paperFetching } from "../../src/tools/paper_fetching.js";
import type { PaperMeta } from "../../src/types.js";

const originalFetch = global.fetch;
const cacheDir = process.env.NEOCORTICA_CACHE || ".cache";

/** Build a ZIP buffer containing a single .md file with the given content. */
function buildMdZip(mdContent: string): Buffer {
  const zip = new AdmZip();
  zip.addFile("paper.md", Buffer.from(mdContent, "utf-8"));
  return zip.toBuffer();
}

/**
 * Create a mock fetch that simulates the full MinerU API flow:
 * 1. POST /file-urls/batch → batch_id + upload URL
 * 2. PUT upload URL → 200
 * 3. GET /extract-results/batch/:id → done + zip URL
 * 4. GET zip URL → ZIP with .md
 */
function mockMineruFetch(mdContent: string): typeof global.fetch {
  const zipBuf = buildMdZip(mdContent);
  return (async (url: any, init?: any) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    const method = init?.method?.toUpperCase() ?? "GET";

    if (urlStr.includes("/file-urls/batch") && method === "POST") {
      return new Response(
        JSON.stringify({
          code: 0,
          data: {
            batch_id: "mock-batch-123",
            file_urls: ["https://mock-upload.example.com/upload"],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (urlStr.includes("mock-upload.example.com") && method === "PUT") {
      return new Response(null, { status: 200 });
    }

    if (urlStr.includes("/extract-results/batch/")) {
      return new Response(
        JSON.stringify({
          code: 0,
          data: {
            extract_result: [
              { state: "done", full_zip_url: "https://mock-zip.example.com/result.zip" },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (urlStr.includes("mock-zip.example.com")) {
      return new Response(zipBuf, { status: 200 });
    }

    return new Response(null, { status: 404 });
  }) as typeof global.fetch;
}

describe("paper_fetching", () => {
  const originalMineru = process.env.MINERU_TOKEN;
  const testTitles: string[] = [];
  const testFiles: string[] = [];

  afterEach(() => {
    process.env.MINERU_TOKEN = originalMineru;
    global.fetch = originalFetch;
    // Clean up test markdown and meta files
    for (const nt of testTitles) {
      const mdPath = resolve(cacheDir, "markdown", `${nt}.md`);
      const metaPath = resolve(cacheDir, "paper", `${nt}.json`);
      try { unlinkSync(mdPath); } catch {}
      try { unlinkSync(metaPath); } catch {}
    }
    for (const f of testFiles) {
      try { unlinkSync(f); } catch {}
    }
    testTitles.length = 0;
    testFiles.length = 0;
  });

  // ── Cache-first behavior ────────────────────────────────

  describe("cache-first strategy", () => {
    it("returns cached markdownPath if markdown already cached", async () => {
      testTitles.push("zztest_cached_fetch");
      const path = saveMarkdown("zztest Cached Fetch", "# cached content");
      const meta: PaperMeta = {
        title: "zztest Cached Fetch",
        normalizedTitle: "zztest_cached_fetch",
        arxivUrl: "https://arxiv.org/abs/2301.00001",
      };

      let fetchCalled = false;
      global.fetch = async () => {
        fetchCalled = true;
        return new Response(null, { status: 404 });
      };

      const result = await paperFetching(meta);
      assert.equal(result.markdownPath, path);
      assert.equal(fetchCalled, false, "fetch should not be called when cache hit");
    });

    it("skips network when cache already has the paper", async () => {
      testTitles.push("zztest_pre_cached");
      const md = "# Pre-cached Paper\n\nSome content";
      const mdPath = saveMarkdown("zztest Pre Cached", md);
      saveMeta({
        title: "zztest Pre Cached",
        normalizedTitle: "zztest_pre_cached",
        arxivId: "2301.00001",
      });

      const result = await paperFetching({
        title: "zztest Pre Cached",
        normalizedTitle: "zztest_pre_cached",
        arxivUrl: "https://arxiv.org/abs/2301.00001",
        oaPdfUrl: "https://arxiv.org/pdf/2301.00001",
      });

      assert.equal(result.markdownPath, mdPath);
    });
  });

  // ── arxiv2md path ────────────────────────────────────────

  describe("arxiv2md fallback", () => {
    it("fetches via arxiv2md when arxivUrl is present", async () => {
      testTitles.push("zztest_arxiv_paper");
      const fakeMarkdown = "# Paper via arxiv2md\n\nContent from arxiv2md service";

      global.fetch = async (url: any) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("arxiv2md")) {
          return new Response(JSON.stringify({ content: fakeMarkdown }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(null, { status: 404 });
      };

      const result = await paperFetching({
        title: "zztest ArXiv Paper",
        normalizedTitle: "zztest_arxiv_paper",
        arxivUrl: "https://arxiv.org/abs/2301.00001",
      });

      assert.ok(result.markdownPath, "should have markdownPath after arxiv2md fetch");
      const content = readFileSync(result.markdownPath!, "utf-8");
      assert.ok(content.includes("arxiv2md"));
    });

    it("saves meta to cache after successful arxiv2md fetch", async () => {
      testTitles.push("zztest_meta_save");
      global.fetch = async () =>
        new Response(JSON.stringify({ content: "# Markdown" }), { status: 200 });

      const meta: PaperMeta = {
        title: "zztest Meta Save",
        normalizedTitle: "zztest_meta_save",
        arxivUrl: "https://arxiv.org/abs/2301.00001",
        arxivId: "2301.00001",
      };

      await paperFetching(meta);

      const loaded = loadMeta("zztest_meta_save");
      assert.ok(loaded, "meta should be cached");
      assert.equal(loaded.arxivId, "2301.00001");
      assert.ok(loaded.markdownPath, "cached meta should have markdownPath");
    });
  });

  // ── MinerU PDF path ──────────────────────────────────────

  describe("MinerU PDF fallback", () => {
    it("falls through to MinerU when no arxivUrl but has oaPdfUrl", async () => {
      testTitles.push("zztest_pdf_only");
      global.fetch = async () => new Response(null, { status: 404 });

      const result = await paperFetching({
        title: "zztest PDF Only",
        normalizedTitle: "zztest_pdf_only",
        oaPdfUrl: "https://example.com/paper.pdf",
      });

      assert.equal(result.markdownPath, undefined);
      assert.equal(result.title, "zztest PDF Only");
    });
  });

  // ── No URLs path ─────────────────────────────────────────

  describe("no URLs available", () => {
    it("returns meta without markdownPath when no URLs present", async () => {
      testTitles.push("zztest_no_urls");
      const meta: PaperMeta = {
        title: "zztest No URLs",
        normalizedTitle: "zztest_no_urls",
        abstract: "This paper has no fetchable URLs",
      };

      const result = await paperFetching(meta);
      assert.equal(result.markdownPath, undefined);
      assert.equal(result.title, "zztest No URLs");
      assert.equal(result.abstract, "This paper has no fetchable URLs");
    });

    it("still saves meta to cache even when no markdown fetched", async () => {
      testTitles.push("zztest_unfetchable");
      await paperFetching({
        title: "zztest Unfetchable",
        normalizedTitle: "zztest_unfetchable",
        doi: "10.1234/unfetchable",
      });

      const loaded = loadMeta("zztest_unfetchable");
      assert.ok(loaded, "meta should still be cached");
      assert.equal(loaded.doi, "10.1234/unfetchable");
      assert.equal(loaded.markdownPath, undefined);
    });
  });

  // ── Progress callback ────────────────────────────────────

  describe("progress callback", () => {
    it("calls onProgress when fetching via arxivUrl", async () => {
      testTitles.push("zztest_progress");
      global.fetch = async () => new Response(null, { status: 404 });

      const messages: string[] = [];
      await paperFetching(
        {
          title: "zztest Progress",
          normalizedTitle: "zztest_progress",
          arxivUrl: "https://arxiv.org/abs/2301.00001",
        },
        async (info) => {
          messages.push(info.message);
        },
      );

      assert.ok(
        messages.some((m) => m.includes("arxiv2md")),
        "should report arxiv2md progress",
      );
    });

    it("calls onProgress when fetching via oaPdfUrl", async () => {
      testTitles.push("zztest_pdf_progress");
      global.fetch = async () => new Response(null, { status: 404 });

      const messages: string[] = [];
      await paperFetching(
        {
          title: "zztest PDF Progress",
          normalizedTitle: "zztest_pdf_progress",
          oaPdfUrl: "https://example.com/paper.pdf",
        },
        async (info) => {
          messages.push(info.message);
        },
      );

      assert.ok(
        messages.some((m) => m.includes("MinerU")),
        "should report MinerU progress",
      );
    });
  });

  // ── Local PDF path ─────────────────────────────────────

  describe("local PDF via pdfPath", () => {
    it("converts local PDF via MinerU and caches result", async () => {
      process.env.MINERU_TOKEN = "mock-token";

      const pdfDir = resolve(cacheDir, "pdf");
      mkdirSync(pdfDir, { recursive: true });
      const pdfFile = resolve(pdfDir, "zztest_local_paper.pdf");
      testFiles.push(pdfFile);
      testTitles.push("zztest_local_paper");
      writeFileSync(pdfFile, Buffer.from("%PDF-1.4 fake pdf content"));

      const fakeMd = "# Local Paper\n\nConverted from local PDF";
      global.fetch = mockMineruFetch(fakeMd);

      const result = await paperFetching({
        title: "zztest Local PDF Paper",
        normalizedTitle: "zztest_local_pdf_paper",
        pdfPath: pdfFile,
      });

      assert.ok(result.markdownPath, "should have markdownPath after local PDF conversion");
      const content = readFileSync(result.markdownPath!, "utf-8");
      assert.ok(content.includes("Local Paper"), "cached markdown should contain converted content");

      assert.equal(result.normalizedTitle, "zztest_local_paper");

      const loaded = loadMeta(result.normalizedTitle);
      assert.ok(loaded, "meta should be cached");
      assert.ok(loaded.markdownPath, "cached meta should have markdownPath");
    });

    it("returns meta without markdownPath when local PDF file does not exist", async () => {
      process.env.MINERU_TOKEN = "mock-token";
      testTitles.push("zztest_missing_pdf");

      const result = await paperFetching({
        title: "zztest Missing PDF",
        normalizedTitle: "zztest_missing_pdf",
        pdfPath: "/nonexistent/path/paper.pdf",
      });

      assert.equal(result.markdownPath, undefined);
      assert.equal(result.title, "zztest Missing PDF");
    });

    it("pdfPath takes priority over arxivUrl and oaPdfUrl", async () => {
      process.env.MINERU_TOKEN = "mock-token";

      const pdfDir = resolve(cacheDir, "pdf");
      mkdirSync(pdfDir, { recursive: true });
      const pdfFile = resolve(pdfDir, "zztest_priority_paper.pdf");
      testFiles.push(pdfFile);
      testTitles.push("zztest_priority_paper");
      writeFileSync(pdfFile, Buffer.from("%PDF-1.4 fake"));

      const localMd = "# From Local PDF";
      global.fetch = mockMineruFetch(localMd);

      const result = await paperFetching({
        title: "zztest Priority Paper",
        normalizedTitle: "zztest_priority_paper",
        pdfPath: pdfFile,
        arxivUrl: "https://arxiv.org/abs/2301.99999",
        oaPdfUrl: "https://example.com/paper.pdf",
      });

      assert.ok(result.markdownPath, "should have markdownPath");
      const content = readFileSync(result.markdownPath!, "utf-8");
      assert.ok(
        content.includes("From Local PDF"),
        "content should come from local PDF, not arxiv2md",
      );
    });

    it("calls onProgress when converting local PDF", async () => {
      process.env.MINERU_TOKEN = "mock-token";

      const pdfDir = resolve(cacheDir, "pdf");
      mkdirSync(pdfDir, { recursive: true });
      const pdfFile = resolve(pdfDir, "zztest_progress_local.pdf");
      testFiles.push(pdfFile);
      testTitles.push("zztest_progress_local");
      writeFileSync(pdfFile, Buffer.from("%PDF-1.4 fake"));

      global.fetch = mockMineruFetch("# Progress Test");

      const messages: string[] = [];
      await paperFetching(
        {
          title: "zztest Progress Local",
          normalizedTitle: "zztest_progress_local",
          pdfPath: pdfFile,
        },
        async (info) => {
          messages.push(info.message);
        },
      );

      assert.ok(
        messages.some((m) => m.includes("local PDF via MinerU")),
        "should report local PDF progress",
      );
    });
  });

  // ── Simulation: realistic batch workflow ─────────────────

  describe("simulation: batch fetching workflow", () => {
    it("simulates fetching 3 papers with mixed sources (cached, local PDF, arxivUrl)", async () => {
      process.env.MINERU_TOKEN = "mock-token";

      // Paper 1: already cached
      testTitles.push("zztest_already_cached");
      saveMarkdown("zztest Already Cached", "# Already Cached\n\nContent");

      // Paper 2: local PDF
      const pdfDir = resolve(cacheDir, "pdf");
      mkdirSync(pdfDir, { recursive: true });
      const localPdf = resolve(pdfDir, "zztest_sim_local.pdf");
      testFiles.push(localPdf);
      testTitles.push("zztest_sim_local");
      writeFileSync(localPdf, Buffer.from("%PDF-1.4 sim"));

      // Paper 3: has arxivUrl
      testTitles.push("zztest_fetchable_arxiv");

      const localMd = "# From Local PDF Sim\n\nLocal content";
      const mineruFetch = mockMineruFetch(localMd);

      global.fetch = (async (url: any, init?: any) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("arxiv2md")) {
          return new Response(
            JSON.stringify({ content: "# Fetched from arXiv\n\nNew content" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return mineruFetch(url, init);
      }) as typeof global.fetch;

      const papers: PaperMeta[] = [
        {
          title: "zztest Already Cached",
          normalizedTitle: "zztest_already_cached",
          arxivUrl: "https://arxiv.org/abs/1111.11111",
        },
        {
          title: "zztest Sim Local PDF",
          normalizedTitle: "zztest_sim_local_pdf",
          pdfPath: localPdf,
        },
        {
          title: "zztest Fetchable ArXiv",
          normalizedTitle: "zztest_fetchable_arxiv",
          arxivUrl: "https://arxiv.org/abs/2222.22222",
        },
      ];

      const results = await Promise.all(papers.map((p) => paperFetching(p)));

      assert.ok(results[0].markdownPath, "cached paper should have markdownPath");
      assert.ok(results[1].markdownPath, "local PDF paper should have markdownPath");
      const localContent = readFileSync(results[1].markdownPath!, "utf-8");
      assert.ok(localContent.includes("From Local PDF Sim"));

      assert.ok(results[2].markdownPath, "arxiv paper should have markdownPath");
      const arxivContent = readFileSync(results[2].markdownPath!, "utf-8");
      assert.ok(arxivContent.includes("Fetched from arXiv"));

      assert.equal(results[0].title, "zztest Already Cached");
      assert.equal(results[2].title, "zztest Fetchable ArXiv");
    });
  });
});
