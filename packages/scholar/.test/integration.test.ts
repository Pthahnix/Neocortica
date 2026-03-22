import { describe, it } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { paperSearching, enrichMeta } from "../src/tools/paper_searching.js";
import { paperFetching } from "../src/tools/paper_fetching.js";
import { paperContent } from "../src/tools/paper_content.js";
import { paperReference } from "../src/tools/paper_reference.js";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

/**
 * Live integration tests — require network + valid API keys.
 * Uses real NEOCORTICA_CACHE from .env so results are visible on disk.
 * Run with: npx tsx --test .test/integration.test.ts
 */

describe("integration: paper_searching", () => {
  it("enriches a known arXiv paper (Attention Is All You Need)", async () => {
    const result = await paperSearching({
      title: "Attention Is All You Need",
      link: "https://arxiv.org/abs/1706.03762",
    });
    assert.ok(result.title);
    assert.equal(result.arxivId, "1706.03762");
    assert.ok(result.arxivUrl);
    console.log("  paper_searching:", JSON.stringify({ arxivId: result.arxivId, s2Id: result.s2Id }, null, 2));
  });

  it("enriches a non-arXiv paper via SS", async () => {
    const result = await enrichMeta({
      title: "ImageNet Classification with Deep Convolutional Neural Networks",
      normalizedTitle: "imagenet_classification_with_deep_convolutional_neural_networks",
    });
    assert.ok(result.normalizedTitle);
    console.log("  non-arXiv:", JSON.stringify({ s2Id: result.s2Id, doi: result.doi, arxivId: result.arxivId }, null, 2));
  });
});

describe("integration: paper_fetching + paper_content", () => {
  it("fetches arXiv paper and reads content back", async () => {
    const fetched = await paperFetching({
      title: "Attention Is All You Need",
      normalizedTitle: "attention_is_all_you_need",
      arxivUrl: "https://arxiv.org/abs/1706.03762",
    });
    assert.ok(fetched.markdownPath);
    console.log("  markdownPath:", fetched.markdownPath);

    const content = paperContent({ normalizedTitle: "attention_is_all_you_need" });
    assert.ok(content);
    assert.ok(content!.content.length > 500);
    console.log("  content length:", content!.content.length);
  });

  it("cache hit on second fetch", async () => {
    // First fetch may already be cached from previous test
    await paperFetching({
      title: "Attention Is All You Need",
      normalizedTitle: "attention_is_all_you_need",
      arxivUrl: "https://arxiv.org/abs/1706.03762",
    });

    const start = Date.now();
    const cached = await paperFetching({
      title: "Attention Is All You Need",
      normalizedTitle: "attention_is_all_you_need",
    });
    assert.ok(cached.markdownPath);
    assert.ok(Date.now() - start < 100, "cache hit should be fast");
    console.log("  cache hit took:", Date.now() - start, "ms");
  });
});

describe("integration: paper_fetching with local PDFs", () => {
  it("converts all local PDFs in .cache/pdf", async () => {
    const pdfDir = resolve(process.env.NEOCORTICA_CACHE || ".cache", "pdf");
    let files: string[];
    try {
      files = readdirSync(pdfDir).filter((f) => f.endsWith(".pdf") && !f.startsWith("zztest_"));
    } catch {
      console.log("  SKIP: no .cache/pdf directory");
      return;
    }

    if (files.length === 0) {
      console.log("  SKIP: no PDF files in .cache/pdf");
      return;
    }

    for (const file of files) {
      const pdfPath = resolve(pdfDir, file);
      console.log(`  Converting: ${file}`);
      const result = await paperFetching({
        title: "",
        normalizedTitle: "",
        pdfPath,
      });
      assert.ok(result.markdownPath, `should convert ${file}`);
      const content = readFileSync(result.markdownPath!, "utf-8");
      assert.ok(content.length > 100, `${file} content should be substantial`);
      console.log(`    OK: ${content.length} chars → ${result.markdownPath}`);
    }
  });
});

describe("integration: paper_reference", () => {
  it("gets references for Attention paper via SS API", async () => {
    const refs = await paperReference({
      title: "Attention Is All You Need",
      normalizedTitle: "attention_is_all_you_need",
      arxivId: "1706.03762",
    });

    if (refs.length === 0) {
      console.log("  NOTE: SS references API returned 0 (may be rate-limited or unreachable)");
      return;
    }

    assert.ok(refs.length > 10, `should have many references, got ${refs.length}`);
    console.log(`  Found ${refs.length} references`);
    for (const r of refs.slice(0, 3)) {
      assert.ok(r.title, "reference should have title");
      console.log(`    ref: ${r.title}`);
    }
  });
});
