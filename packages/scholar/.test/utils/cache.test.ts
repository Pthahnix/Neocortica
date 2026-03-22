import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, unlinkSync } from "fs";
import { join, resolve } from "path";
import "dotenv/config";
import { saveMarkdown, saveMeta, loadMeta, loadMarkdownPath } from "../../src/utils/cache.js";
import type { PaperMeta } from "../../src/types.js";

const cacheDir = process.env.NEOCORTICA_CACHE || ".cache";

/** Clean up test files after each test. */
function cleanupTestFiles(normalizedTitles: string[]) {
  for (const nt of normalizedTitles) {
    const mdPath = resolve(cacheDir, "markdown", `${nt}.md`);
    const metaPath = resolve(cacheDir, "paper", `${nt}.json`);
    try { unlinkSync(mdPath); } catch {}
    try { unlinkSync(metaPath); } catch {}
  }
}

describe("cache", () => {
  const testTitles: string[] = [];

  afterEach(() => {
    cleanupTestFiles(testTitles);
    testTitles.length = 0;
  });

  // ── saveMarkdown ──────────────────────────────────────────────

  describe("saveMarkdown", () => {
    it("saves markdown and returns absolute path", () => {
      testTitles.push("zztest_hello_world");
      const path = saveMarkdown("zztest Hello World", "# Hello World");
      assert.ok(path.endsWith(".md"));
      assert.ok(existsSync(path));
      assert.equal(readFileSync(path, "utf-8"), "# Hello World");
    });

    it("normalizes title for filename", () => {
      testTitles.push("zztest_gpt_4_a_large_model");
      const path = saveMarkdown("zztest GPT-4: A Large Model", "content");
      assert.ok(path.includes("zztest_gpt_4_a_large_model.md"));
    });

    it("overwrites existing file with same title", () => {
      testTitles.push("zztest_same_title");
      saveMarkdown("zztest Same Title", "version 1");
      const path = saveMarkdown("zztest Same Title", "version 2");
      assert.equal(readFileSync(path, "utf-8"), "version 2");
    });

    it("handles large markdown content", () => {
      testTitles.push("zztest_big_paper");
      const bigContent = "# Paper\n" + "Lorem ipsum. ".repeat(10000);
      const path = saveMarkdown("zztest Big Paper", bigContent);
      assert.equal(readFileSync(path, "utf-8"), bigContent);
    });

    it("handles markdown with unicode content", () => {
      testTitles.push("zztest_unicode_paper");
      const content = "# 论文标题\n\nMathematical formulas: ∑∫∂";
      const path = saveMarkdown("zztest Unicode Paper", content);
      assert.equal(readFileSync(path, "utf-8"), content);
    });
  });

  // ── saveMeta / loadMeta ───────────────────────────────────────

  describe("saveMeta + loadMeta", () => {
    it("round-trips full PaperMeta with all fields", () => {
      testTitles.push("zztest_attention_full");
      const fullMeta: PaperMeta = {
        title: "zztest Attention Full",
        normalizedTitle: "zztest_attention_full",
        arxivId: "1706.03762",
        doi: "10.48550/arXiv.1706.03762",
        s2Id: "abc123",
        abstract: "The dominant sequence transduction models...",
        arxivUrl: "https://arxiv.org/abs/1706.03762",
        oaPdfUrl: "https://arxiv.org/pdf/1706.03762",
        year: 2017,
        authors: "Vaswani, Shazeer, Parmar",
        citationCount: 95000,
        sourceUrl: "https://papers.nips.cc/paper/7181",
        markdownPath: "/some/path/to/paper.md",
      };
      saveMeta(fullMeta);
      const loaded = loadMeta("zztest_attention_full");
      assert.deepEqual(loaded, fullMeta);
    });

    it("round-trips minimal PaperMeta", () => {
      testTitles.push("zztest_minimal");
      const minimal: PaperMeta = {
        title: "zztest Minimal",
        normalizedTitle: "zztest_minimal",
      };
      saveMeta(minimal);
      const loaded = loadMeta("zztest_minimal");
      assert.deepEqual(loaded, minimal);
    });

    it("returns null for nonexistent meta", () => {
      assert.equal(loadMeta("zztest_does_not_exist_99999"), null);
    });

    it("overwrites existing meta", () => {
      testTitles.push("zztest_overwrite");
      const v1: PaperMeta = { title: "zztest Overwrite", normalizedTitle: "zztest_overwrite", year: 2020 };
      const v2: PaperMeta = { title: "zztest Overwrite", normalizedTitle: "zztest_overwrite", year: 2021 };
      saveMeta(v1);
      saveMeta(v2);
      const loaded = loadMeta("zztest_overwrite");
      assert.equal(loaded?.year, 2021);
    });

    it("preserves optional undefined fields as absent in JSON", () => {
      testTitles.push("zztest_undef_fields");
      const meta: PaperMeta = { title: "zztest Undef Fields", normalizedTitle: "zztest_undef_fields" };
      saveMeta(meta);
      const raw = readFileSync(
        resolve(cacheDir, "paper", "zztest_undef_fields.json"),
        "utf-8",
      );
      const parsed = JSON.parse(raw);
      assert.ok(!("arxivId" in parsed));
      assert.ok(!("doi" in parsed));
    });
  });

  // ── loadMarkdownPath ──────────────────────────────────────────

  describe("loadMarkdownPath", () => {
    it("returns path when markdown exists", () => {
      testTitles.push("zztest_cached_paper");
      const saved = saveMarkdown("zztest Cached Paper", "# content");
      const found = loadMarkdownPath("zztest_cached_paper");
      assert.equal(found, saved);
    });

    it("returns null when markdown does not exist", () => {
      assert.equal(loadMarkdownPath("zztest_nonexistent_99999"), null);
    });

    it("works after saving with different title casing", () => {
      testTitles.push("zztest_my_paper_title");
      saveMarkdown("zztest My Paper Title", "# content");
      const found = loadMarkdownPath("zztest_my_paper_title");
      assert.ok(found !== null);
    });
  });

  // ── Simulation: realistic workflow ────────────────────────────

  describe("simulation: realistic search-then-cache workflow", () => {
    it("simulates caching 5 papers from a search batch", () => {
      const titles = [
        "zztest_sim_attention",
        "zztest_sim_bert",
        "zztest_sim_gpt3",
        "zztest_sim_scaling",
        "zztest_sim_vit",
      ];
      testTitles.push(...titles);

      const papers: PaperMeta[] = [
        {
          title: "zztest Sim Attention",
          normalizedTitle: "zztest_sim_attention",
          arxivId: "1706.03762",
          abstract: "The dominant sequence transduction models...",
          arxivUrl: "https://arxiv.org/abs/1706.03762",
          year: 2017,
          authors: "Vaswani et al.",
          citationCount: 95000,
        },
        {
          title: "zztest Sim BERT",
          normalizedTitle: "zztest_sim_bert",
          doi: "10.18653/v1/N19-1423",
          abstract: "We introduce a new language representation model...",
          year: 2019,
          authors: "Devlin et al.",
        },
        {
          title: "zztest Sim GPT3",
          normalizedTitle: "zztest_sim_gpt3",
          arxivId: "2005.14165",
          abstract: "We demonstrate that scaling up language models...",
          arxivUrl: "https://arxiv.org/abs/2005.14165",
          year: 2020,
        },
        {
          title: "zztest Sim Scaling",
          normalizedTitle: "zztest_sim_scaling",
          abstract: "We study empirical scaling laws...",
          year: 2020,
        },
        {
          title: "zztest Sim ViT",
          normalizedTitle: "zztest_sim_vit",
          arxivId: "2010.11929",
          abstract: "While the Transformer architecture has become...",
          arxivUrl: "https://arxiv.org/abs/2010.11929",
          oaPdfUrl: "https://arxiv.org/pdf/2010.11929",
          year: 2021,
        },
      ];

      // Save all meta
      for (const p of papers) {
        saveMeta(p);
      }

      // Save markdown for 3 of them (simulating successful fetch)
      saveMarkdown(papers[0].title, "# Attention Is All You Need\n\nContent...");
      saveMarkdown(papers[2].title, "# GPT-3 Paper\n\nContent...");
      saveMarkdown(papers[4].title, "# ViT Paper\n\nContent...");

      // Verify all meta is loadable
      for (const p of papers) {
        const loaded = loadMeta(p.normalizedTitle);
        assert.ok(loaded, `Meta for "${p.title}" should be loadable`);
        assert.equal(loaded.title, p.title);
      }

      // Verify only 3 have cached markdown
      assert.ok(loadMarkdownPath("zztest_sim_attention"));
      assert.equal(loadMarkdownPath("zztest_sim_bert"), null);
      assert.ok(loadMarkdownPath("zztest_sim_gpt3"));
      assert.equal(loadMarkdownPath("zztest_sim_scaling"), null);
      assert.ok(loadMarkdownPath("zztest_sim_vit"));
    });
  });
});
