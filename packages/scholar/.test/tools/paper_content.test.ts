import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { unlinkSync } from "fs";
import { resolve } from "path";
import "dotenv/config";
import { paperContent } from "../../src/tools/paper_content.js";
import { saveMarkdown } from "../../src/utils/cache.js";

const cacheDir = process.env.NEOCORTICA_CACHE || ".cache";

function cleanupTestFiles(normalizedTitles: string[]) {
  for (const nt of normalizedTitles) {
    const mdPath = resolve(cacheDir, "markdown", `${nt}.md`);
    try { unlinkSync(mdPath); } catch {}
  }
}

describe("paper_content", () => {
  const testTitles: string[] = [];

  afterEach(() => {
    cleanupTestFiles(testTitles);
    testTitles.length = 0;
  });

  it("returns markdown content by normalizedTitle", () => {
    testTitles.push("zztest_content_paper");
    saveMarkdown("zztest Content Paper", "# Hello\n\nThis is a test paper.");
    const result = paperContent({ normalizedTitle: "zztest_content_paper" });
    assert.ok(result);
    assert.equal(result!.content, "# Hello\n\nThis is a test paper.");
    assert.ok(result!.markdownPath.endsWith("zztest_content_paper.md"));
  });

  it("derives normalizedTitle from title when not provided", () => {
    testTitles.push("zztest_great_paper");
    saveMarkdown("zztest Great Paper", "# Content here");
    const result = paperContent({ title: "zztest Great Paper" });
    assert.ok(result);
    assert.equal(result!.content, "# Content here");
  });

  it("returns null when paper not cached", () => {
    const result = paperContent({ normalizedTitle: "zztest_nonexistent_paper_99999" });
    assert.equal(result, null);
  });

  it("returns null when neither title nor normalizedTitle provided", () => {
    const result = paperContent({});
    assert.equal(result, null);
  });

  it("handles title with special characters", () => {
    testTitles.push("zztest_bert_pre_training_of_transformers");
    saveMarkdown("zztest BERT: Pre-training of Transformers", "# BERT content");
    const result = paperContent({ title: "zztest BERT: Pre-training of Transformers" });
    assert.ok(result);
    assert.equal(result!.content, "# BERT content");
  });
});
