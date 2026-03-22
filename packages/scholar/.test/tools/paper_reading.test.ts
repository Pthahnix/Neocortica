import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, unlinkSync, mkdirSync } from "fs";
import { resolve } from "path";
import "dotenv/config";

const cacheDir = process.env.NEOCORTICA_CACHE || ".cache";

describe("paper_reading", () => {
  const testFiles: string[] = [];

  afterEach(() => {
    for (const f of testFiles) {
      try { unlinkSync(f); } catch {}
    }
    testFiles.length = 0;
  });

  it("loads three-pass reading prompt from prompt/paper-reading.md", () => {
    const promptPath = resolve("prompt/paper-reading.md");
    const content = readFileSync(promptPath, "utf-8");
    assert.ok(content.includes("Three-Pass"), "should contain Three-Pass heading");
    assert.ok(content.includes("Pass 1"), "should contain Pass 1");
    assert.ok(content.includes("Pass 2"), "should contain Pass 2");
    assert.ok(content.includes("Pass 3"), "should contain Pass 3");
    assert.ok(content.includes("Five Cs"), "should contain Five Cs");
    assert.ok(content.includes("Keshav"), "should reference Keshav");
  });

  it("module exports paperReading function", async () => {
    const mod = await import("../../src/tools/paper_reading.js");
    assert.equal(typeof mod.paperReading, "function");
  });

  it("returns empty for empty input", async () => {
    const { paperReading } = await import("../../src/tools/paper_reading.js");
    const results = await paperReading({ papers: [] });
    assert.deepEqual(results, []);
  });

  it("batches papers correctly", () => {
    const papers = [
      { markdownPath: "a.md", title: "A" },
      { markdownPath: "b.md", title: "B" },
      { markdownPath: "c.md", title: "C" },
    ];
    const batchSize = 2;
    const batches: typeof papers[] = [];
    for (let i = 0; i < papers.length; i += batchSize) {
      batches.push(papers.slice(i, i + batchSize));
    }
    assert.equal(batches.length, 2);
    assert.equal(batches[0].length, 2);
    assert.equal(batches[1].length, 1);
    assert.deepEqual(batches[0].map(p => p.title), ["A", "B"]);
    assert.deepEqual(batches[1].map(p => p.title), ["C"]);
  });

  it("builds user message with paper content and title", () => {
    const mdDir = resolve(cacheDir, "markdown");
    mkdirSync(mdDir, { recursive: true });
    const p1 = resolve(mdDir, "zztest_reading_paper1.md");
    const p2 = resolve(mdDir, "zztest_reading_paper2.md");
    testFiles.push(p1, p2);
    writeFileSync(p1, "# Paper One Content");
    writeFileSync(p2, "# Paper Two Content");

    const batch = [
      { markdownPath: p1, title: "Paper One" },
      { markdownPath: p2, title: "Paper Two" },
    ];

    const parts = batch.map((p) => {
      const content = readFileSync(p.markdownPath, "utf-8");
      const title = p.title ?? p.markdownPath;
      return `--- Paper: ${title} ---\n\n${content}`;
    });
    const userMessage = parts.join("\n\n---\n\n");

    assert.ok(userMessage.includes("--- Paper: Paper One ---"));
    assert.ok(userMessage.includes("# Paper One Content"));
    assert.ok(userMessage.includes("--- Paper: Paper Two ---"));
    assert.ok(userMessage.includes("# Paper Two Content"));
  });

  it("uses markdownPath as title when title not provided", () => {
    const mdDir = resolve(cacheDir, "markdown");
    mkdirSync(mdDir, { recursive: true });
    const p = resolve(mdDir, "zztest_reading_notitle.md");
    testFiles.push(p);
    writeFileSync(p, "# Content");

    const batch = [{ markdownPath: p }];
    const titles = batch.map((b) => b.title ?? b.markdownPath);
    assert.equal(titles[0], p);
  });
});
