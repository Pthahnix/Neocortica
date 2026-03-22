import { describe, it } from "node:test";
import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { extractMarkdownFromZip } from "../../src/utils/pdf.js";

describe("pdf (MinerU)", () => {
  // ── extractMarkdownFromZip ────────────────────────────────

  describe("extractMarkdownFromZip", () => {
    it("extracts markdown from a zip with a single .md file", () => {
      const zip = new AdmZip();
      zip.addFile("output/paper.md", Buffer.from("# Paper Title\n\nContent here."));
      const buf = zip.toBuffer();
      const result = extractMarkdownFromZip(buf);
      assert.equal(result, "# Paper Title\n\nContent here.");
    });

    it("extracts markdown from a zip with nested directory structure", () => {
      const zip = new AdmZip();
      zip.addFile("batch_123/result/full.md", Buffer.from("# Full Paper\n\nSection 1..."));
      zip.addFile("batch_123/result/images/fig1.png", Buffer.from("fake-png"));
      const buf = zip.toBuffer();
      const result = extractMarkdownFromZip(buf);
      assert.equal(result, "# Full Paper\n\nSection 1...");
    });

    it("picks the first .md file when multiple exist", () => {
      const zip = new AdmZip();
      zip.addFile("a_first.md", Buffer.from("# First"));
      zip.addFile("b_second.md", Buffer.from("# Second"));
      const buf = zip.toBuffer();
      const result = extractMarkdownFromZip(buf);
      // AdmZip preserves insertion order, so first .md file wins
      assert.equal(result, "# First");
    });

    it("throws when zip has no .md file", () => {
      const zip = new AdmZip();
      zip.addFile("output/paper.txt", Buffer.from("plain text"));
      zip.addFile("output/data.json", Buffer.from('{"key":"value"}'));
      const buf = zip.toBuffer();
      assert.throws(() => extractMarkdownFromZip(buf), /No .md file found/);
    });

    it("handles large markdown content in zip", () => {
      const bigContent = "# Paper\n\n" + "Lorem ipsum dolor sit amet. ".repeat(5000);
      const zip = new AdmZip();
      zip.addFile("paper.md", Buffer.from(bigContent));
      const buf = zip.toBuffer();
      const result = extractMarkdownFromZip(buf);
      assert.equal(result, bigContent);
    });

    it("handles markdown with unicode content in zip", () => {
      const unicodeContent = "# 论文\n\n数学公式: ∑_{i=1}^{n} x_i = S\n\nÜber résumé";
      const zip = new AdmZip();
      zip.addFile("paper.md", Buffer.from(unicodeContent));
      const buf = zip.toBuffer();
      const result = extractMarkdownFromZip(buf);
      assert.equal(result, unicodeContent);
    });

    it("handles zip with mixed file types alongside .md", () => {
      const zip = new AdmZip();
      zip.addFile("output/images/figure1.png", Buffer.from("fake-png-data"));
      zip.addFile("output/images/figure2.jpg", Buffer.from("fake-jpg-data"));
      zip.addFile("output/paper.md", Buffer.from("# Paper with Figures\n\n![fig1](images/figure1.png)"));
      zip.addFile("output/metadata.json", Buffer.from('{"pages": 12}'));
      const buf = zip.toBuffer();
      const result = extractMarkdownFromZip(buf);
      assert.ok(result.includes("# Paper with Figures"));
      assert.ok(result.includes("![fig1]"));
    });
  });

  // ── Simulation: MinerU-like zip output ────────────────────

  describe("simulation: realistic MinerU output zip", () => {
    it("processes a zip mimicking real MinerU output structure", () => {
      // MinerU returns a zip with structure like:
      // batch_abc123/
      //   output/
      //     full.md
      //     images/
      //       page_0_img_0.png
      //       page_1_img_0.png
      //     layout/
      //       page_0.json
      const zip = new AdmZip();
      const paperMd = [
        "# Attention Is All You Need",
        "",
        "## Abstract",
        "",
        "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...",
        "",
        "## 1 Introduction",
        "",
        "Recurrent neural networks, long short-term memory and gated recurrent neural networks...",
        "",
        "![Figure 1](images/page_0_img_0.png)",
        "",
        "## 2 Background",
        "",
        "The goal of reducing sequential computation also forms the foundation of the Extended Neural GPU...",
        "",
        "## References",
        "",
        '[1] Bahdanau, D. "Neural Machine Translation by Jointly Learning to Align and Translate." ICLR 2015.',
        '[2] Sutskever, I. "Sequence to Sequence Learning with Neural Networks." NeurIPS 2014.',
      ].join("\n");

      zip.addFile("batch_abc123/output/full.md", Buffer.from(paperMd));
      zip.addFile("batch_abc123/output/images/page_0_img_0.png", Buffer.from("fake-png"));
      zip.addFile("batch_abc123/output/images/page_1_img_0.png", Buffer.from("fake-png"));
      zip.addFile("batch_abc123/output/layout/page_0.json", Buffer.from('{"blocks":[]}'));

      const buf = zip.toBuffer();
      const result = extractMarkdownFromZip(buf);

      // Verify key sections are present
      assert.ok(result.includes("# Attention Is All You Need"));
      assert.ok(result.includes("## Abstract"));
      assert.ok(result.includes("## 1 Introduction"));
      assert.ok(result.includes("## References"));
      assert.ok(result.includes("![Figure 1]"));
      assert.ok(result.includes("Bahdanau"));
    });
  });
});
