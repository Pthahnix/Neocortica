import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync } from "fs";
import { resolve } from "path";
import "dotenv/config";
import { paperReference, extractReferenceTitles } from "../../src/tools/paper_reference.js";
import type { PaperMeta } from "../../src/types.js";

const originalFetch = global.fetch;
const cacheDir = process.env.NEOCORTICA_CACHE || ".cache";

describe("paper_reference", () => {
  const testFiles: string[] = [];

  afterEach(() => {
    global.fetch = originalFetch;
    for (const f of testFiles) {
      try { unlinkSync(f); } catch {}
    }
    testFiles.length = 0;
  });

  // ── SS API primary path ─────────────────────────────────────

  it("fetches references via SS API using s2Id", async () => {
    global.fetch = async (url: any) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/paper/ss123/references")) {
        return new Response(JSON.stringify({
          data: [
            { citedPaper: { paperId: "r1", title: "Ref Paper One Title", year: 2020, authors: [{ name: "A" }], externalIds: { ArXiv: "2001.00001" }, citationCount: 10 } },
            { citedPaper: { paperId: "r2", title: "Ref Paper Two Title", year: 2021, authors: [{ name: "B" }], externalIds: {}, citationCount: 5 } },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(null, { status: 404 });
    };

    const meta: PaperMeta = { title: "Parent", normalizedTitle: "parent", s2Id: "ss123" };
    const refs = await paperReference(meta);
    assert.equal(refs.length, 2);
    assert.equal(refs[0].arxivId, "2001.00001");
  });

  it("uses ARXIV: prefix when only arxivId available", async () => {
    let capturedUrl = "";
    global.fetch = async (url: any) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      capturedUrl = urlStr;
      return new Response(JSON.stringify({ data: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } });
    };

    const meta: PaperMeta = { title: "T", normalizedTitle: "t", arxivId: "1706.03762" };
    const refs = await paperReference(meta);
    assert.deepEqual(refs, []);
    assert.ok(capturedUrl.includes("ARXIV"), "Should use ARXIV: prefix");
  });

  it("uses DOI: prefix when only doi available", async () => {
    let capturedUrl = "";
    global.fetch = async (url: any) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      capturedUrl = urlStr;
      return new Response(JSON.stringify({ data: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } });
    };

    const meta: PaperMeta = { title: "T", normalizedTitle: "t", doi: "10.1234/test" };
    const refs = await paperReference(meta);
    assert.deepEqual(refs, []);
    assert.ok(capturedUrl.includes("DOI"), "Should use DOI: prefix");
  });

  // ── Markdown fallback ───────────────────────────────────────

  it("falls back to markdown parsing when no IDs available", async () => {
    global.fetch = async () => new Response(JSON.stringify({ data: [] }),
      { status: 200, headers: { "Content-Type": "application/json" } });

    const mdPath = resolve(cacheDir, "markdown", "zztest_ref_fallback.md");
    testFiles.push(mdPath);
    writeFileSync(mdPath, `# Paper\n\n## References\n\n[1] Smith. "A Very Important Reference Paper Title." 2020.\n`);

    const meta: PaperMeta = { title: "T", normalizedTitle: "t", markdownPath: mdPath };
    const refs = await paperReference(meta);
    assert.equal(refs.length, 1);
    assert.equal(refs[0].title, "A Very Important Reference Paper Title");
  });

  it("returns empty when no IDs and no markdownPath", async () => {
    const meta: PaperMeta = { title: "T", normalizedTitle: "t" };
    const refs = await paperReference(meta);
    assert.deepEqual(refs, []);
  });

  it("falls back to markdown when SS API returns error", async () => {
    global.fetch = async (url: any) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/references")) return new Response(null, { status: 500 });
      return new Response(JSON.stringify({ data: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } });
    };

    const mdPath = resolve(cacheDir, "markdown", "zztest_ref_fallback2.md");
    testFiles.push(mdPath);
    writeFileSync(mdPath, `## References\n\n[1] A. "Fallback Reference Title Long Enough." 2021.\n`);

    const meta: PaperMeta = { title: "T", normalizedTitle: "t", s2Id: "fail", markdownPath: mdPath };
    const refs = await paperReference(meta);
    assert.equal(refs.length, 1);
    assert.equal(refs[0].title, "Fallback Reference Title Long Enough");
  });

  // ── extractReferenceTitles ──────────────────────────────────

  describe("extractReferenceTitles", () => {
    it("extracts numbered references with quoted titles", () => {
      const md = `## References\n\n[1] Smith. "A Very Long Paper Title Here." 2020.\n[2] Jones. "Another Paper Title That Is Long." 2021.\n`;
      const titles = extractReferenceTitles(md);
      assert.equal(titles.length, 2);
      assert.equal(titles[0], "A Very Long Paper Title Here");
    });

    it("returns empty for no references section", () => {
      const md = `# Paper\n\nSome content without references.\n`;
      assert.deepEqual(extractReferenceTitles(md), []);
    });

    it("filters short titles", () => {
      const md = `## References\n\n[1] A. "Short." 2020.\n[2] B. "This Is A Sufficiently Long Title." 2020.\n`;
      const titles = extractReferenceTitles(md);
      assert.equal(titles.length, 1);
      assert.equal(titles[0], "This Is A Sufficiently Long Title");
    });
  });
});
