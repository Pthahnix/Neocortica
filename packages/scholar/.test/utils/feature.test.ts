import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { unlinkSync } from "fs";
import { resolve } from "path";
import "dotenv/config";
import { normTitle } from "../../src/utils/misc.js";
import { saveMarkdown, saveMeta, loadMeta, loadMarkdownPath } from "../../src/utils/cache.js";
import { urlToId, idToUrl, parseEntry } from "../../src/utils/arxiv.js";
import { mapPaper } from "../../src/utils/ss.js";
import type { PaperMeta } from "../../src/types.js";

const cacheDir = process.env.NEOCORTICA_CACHE || ".cache";

function cleanupTestFiles(normalizedTitles: string[]) {
  for (const nt of normalizedTitles) {
    const mdPath = resolve(cacheDir, "markdown", `${nt}.md`);
    const metaPath = resolve(cacheDir, "paper", `${nt}.json`);
    try { unlinkSync(mdPath); } catch {}
    try { unlinkSync(metaPath); } catch {}
  }
}

/**
 * Feature test: all utils working together.
 * Simulates a realistic pipeline: parse API data → normalize → cache.
 */
describe("feature: utils integration", () => {
  const testTitles: string[] = [];

  afterEach(() => {
    cleanupTestFiles(testTitles);
    testTitles.length = 0;
  });

  it("arXiv parse → normalize → cache roundtrip", () => {
    const entry = {
      id: "https://arxiv.org/abs/1706.03762v7",
      title: "zztest Attention Feature",
      summary: "The dominant sequence transduction models...",
      author: [{ name: "Vaswani" }, { name: "Shazeer" }],
      published: "2017-06-12T17:57:34Z",
    };
    const meta = parseEntry(entry);
    assert.ok(meta);
    testTitles.push(meta.normalizedTitle);

    assert.equal(meta.normalizedTitle, normTitle(meta.title));

    saveMeta(meta);
    const loaded = loadMeta(meta.normalizedTitle);
    assert.deepEqual(loaded, meta);

    const fakeMarkdown = "# zztest Attention Feature\n\n## Abstract\n\nContent...";
    const mdPath = saveMarkdown(meta.title, fakeMarkdown);

    const cachedPath = loadMarkdownPath(meta.normalizedTitle);
    assert.equal(cachedPath, mdPath);
  });

  it("Semantic Scholar parse → normalize → cache roundtrip", () => {
    const raw = {
      paperId: "204e3073",
      title: "zztest BERT Feature",
      year: 2019,
      authors: [{ name: "Devlin" }, { name: "Chang" }],
      abstract: "We introduce a new language representation model...",
      citationCount: 65000,
      externalIds: { ArXiv: "1810.04805", DOI: "10.18653/v1/N19-1423" },
      openAccessPdf: { url: "https://arxiv.org/pdf/1810.04805" },
      url: "https://www.semanticscholar.org/paper/204e3073",
    };
    const meta = mapPaper(raw);
    assert.ok(meta);
    testTitles.push(meta.normalizedTitle);

    assert.equal(meta.normalizedTitle, normTitle(meta.title));
    assert.equal(meta.arxivUrl, idToUrl(meta.arxivId!));
    assert.equal(urlToId(meta.arxivUrl!), meta.arxivId);

    saveMeta(meta);
    const loaded = loadMeta(meta.normalizedTitle);
    assert.ok(loaded);
    assert.equal(loaded.s2Id, "204e3073");
    assert.equal(loaded.doi, "10.18653/v1/N19-1423");
    assert.equal(loaded.oaPdfUrl, "https://arxiv.org/pdf/1810.04805");
  });

  it("simulates a full search batch: parse → deduplicate → cache", () => {
    const arxivEntry = {
      id: "https://arxiv.org/abs/2005.14165v4",
      title: "zztest GPT3 Feature",
      summary: "Recent work has demonstrated substantial gains...",
      author: [{ name: "Brown" }],
      published: "2020-05-28",
    };

    const ssRaw = {
      paperId: "gpt3_id",
      title: "zztest GPT3 Feature",
      year: 2020,
      authors: [{ name: "Tom Brown" }, { name: "Benjamin Mann" }],
      abstract: "Recent work has demonstrated substantial gains on many NLP benchmarks...",
      citationCount: 25000,
      externalIds: { ArXiv: "2005.14165" },
      openAccessPdf: { url: "https://arxiv.org/pdf/2005.14165" },
      url: "https://semanticscholar.org/paper/gpt3_id",
    };

    const fromArxiv = parseEntry(arxivEntry)!;
    const fromSS = mapPaper(ssRaw)!;
    testTitles.push(fromArxiv.normalizedTitle);

    assert.equal(fromArxiv.normalizedTitle, fromSS.normalizedTitle);

    const merged: PaperMeta = { ...fromArxiv, ...fromSS };
    assert.equal(merged.s2Id, "gpt3_id");
    assert.equal(merged.arxivId, "2005.14165");
    assert.equal(merged.citationCount, 25000);
    assert.ok(merged.oaPdfUrl);

    saveMeta(merged);
    saveMarkdown(merged.title, "# zztest GPT-3 Paper\n\nContent...");

    const loadedMeta = loadMeta(merged.normalizedTitle);
    assert.ok(loadedMeta);
    assert.equal(loadedMeta.s2Id, "gpt3_id");

    const mdPath = loadMarkdownPath(merged.normalizedTitle);
    assert.ok(mdPath);
  });

  it("verifies dedup across title variants", () => {
    const variants = [
      "zztest Dedup Paper",
      "zztest dedup paper",
      "  zztest  Dedup  Paper  ",
      "ZZTEST DEDUP PAPER",
    ];

    const normalized = variants.map(normTitle);
    const unique = new Set(normalized);
    assert.equal(unique.size, 1);
    testTitles.push(normalized[0]);

    const meta: PaperMeta = {
      title: variants[0],
      normalizedTitle: normalized[0],
      abstract: "Test abstract",
    };
    saveMeta(meta);

    for (const n of normalized) {
      const loaded = loadMeta(n);
      assert.ok(loaded, `Should load with normalizedTitle: ${n}`);
      assert.equal(loaded.title, variants[0]);
    }
  });
});
