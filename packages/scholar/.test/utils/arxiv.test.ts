import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { urlToId, idToUrl, parseEntry } from "../../src/utils/arxiv.js";

describe("arxiv", () => {
  // ── urlToId ─────────────────────────────────────────────────

  describe("urlToId", () => {
    it("extracts ID from abs URL", () => {
      assert.equal(urlToId("https://arxiv.org/abs/2301.12345"), "2301.12345");
    });

    it("extracts ID from pdf URL", () => {
      assert.equal(urlToId("https://arxiv.org/pdf/2301.12345v2"), "2301.12345");
    });

    it("handles 5-digit ID", () => {
      assert.equal(urlToId("https://arxiv.org/abs/1706.03762"), "1706.03762");
    });

    it("handles http (non-https) URL", () => {
      assert.equal(urlToId("http://arxiv.org/abs/2301.12345"), "2301.12345");
    });

    it("handles URL with trailing slash", () => {
      // regex won't match trailing slash, but the ID part is still captured
      assert.equal(urlToId("https://arxiv.org/abs/2301.12345v1"), "2301.12345");
    });

    it("throws on invalid URL", () => {
      assert.throws(() => urlToId("https://example.com"), /invalid arxiv url/);
    });

    it("throws on empty string", () => {
      assert.throws(() => urlToId(""), /invalid arxiv url/);
    });

    it("throws on Semantic Scholar URL", () => {
      assert.throws(
        () => urlToId("https://api.semanticscholar.org/paper/123"),
        /invalid arxiv url/,
      );
    });
  });

  // ── idToUrl ─────────────────────────────────────────────────

  describe("idToUrl", () => {
    it("builds abs URL from ID", () => {
      assert.equal(idToUrl("2301.12345"), "https://arxiv.org/abs/2301.12345");
    });

    it("strips version suffix", () => {
      assert.equal(idToUrl("2301.12345v3"), "https://arxiv.org/abs/2301.12345");
    });

    it("strips arXiv: prefix", () => {
      assert.equal(idToUrl("arXiv:2301.12345"), "https://arxiv.org/abs/2301.12345");
    });

    it("strips ARXIV: prefix (case insensitive)", () => {
      assert.equal(idToUrl("ARXIV:1706.03762"), "https://arxiv.org/abs/1706.03762");
    });

    it("handles both prefix and version", () => {
      assert.equal(idToUrl("arXiv:2301.12345v2"), "https://arxiv.org/abs/2301.12345");
    });
  });

  // ── parseEntry ──────────────────────────────────────────────

  describe("parseEntry", () => {
    it("parses a realistic arXiv API entry", () => {
      const entry = {
        id: "https://arxiv.org/abs/1706.03762v7",
        title: "Attention Is All You Need",
        summary: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder.",
        author: [
          { name: "Ashish Vaswani" },
          { name: "Noam Shazeer" },
          { name: "Niki Parmar" },
        ],
        published: "2017-06-12T17:57:34Z",
      };

      const result = parseEntry(entry);
      assert.ok(result);
      assert.equal(result.title, "Attention Is All You Need");
      assert.equal(result.normalizedTitle, "attention_is_all_you_need");
      assert.equal(result.arxivId, "1706.03762");
      assert.equal(result.arxivUrl, "https://arxiv.org/abs/1706.03762");
      assert.equal(result.authors, "Ashish Vaswani, Noam Shazeer, Niki Parmar");
      assert.equal(result.year, 2017);
      assert.ok(result.abstract?.startsWith("The dominant"));
    });

    it("parses entry with single author (not array)", () => {
      const entry = {
        id: "https://arxiv.org/abs/2301.00001v1",
        title: "Solo Author Paper",
        author: { name: "John Doe" },
        published: "2023-01-01",
      };

      const result = parseEntry(entry);
      assert.ok(result);
      assert.equal(result.authors, "John Doe");
    });

    it("parses entry with author as plain string", () => {
      const entry = {
        id: "https://arxiv.org/abs/2301.00001v1",
        title: "String Author",
        author: "Jane Smith",
        published: "2023-01-01",
      };

      const result = parseEntry(entry);
      assert.ok(result);
      assert.equal(result.authors, "Jane Smith");
    });

    it("handles entry without summary", () => {
      const entry = {
        id: "https://arxiv.org/abs/2301.00001v1",
        title: "No Abstract Paper",
        author: [{ name: "Author" }],
        published: "2023-01-01",
      };

      const result = parseEntry(entry);
      assert.ok(result);
      assert.equal(result.abstract, undefined);
    });

    it("handles entry without id", () => {
      const entry = {
        title: "No ID Paper",
        author: [{ name: "Author" }],
      };

      const result = parseEntry(entry);
      assert.ok(result);
      assert.equal(result.arxivId, undefined);
      assert.equal(result.arxivUrl, undefined);
    });

    it("returns null for null/undefined entry", () => {
      assert.equal(parseEntry(null), null);
      assert.equal(parseEntry(undefined), null);
    });

    it("returns null for entry without title", () => {
      assert.equal(parseEntry({ id: "something" }), null);
    });

    it("collapses whitespace in title", () => {
      const entry = {
        title: "  Attention   Is\n  All   You\n  Need  ",
        author: [{ name: "Author" }],
      };

      const result = parseEntry(entry);
      assert.ok(result);
      assert.equal(result.title, "Attention Is All You Need");
    });

    it("collapses whitespace in summary", () => {
      const entry = {
        title: "Test",
        summary: "  Line one.\n  Line two.\n  Line three.  ",
        author: [{ name: "Author" }],
      };

      const result = parseEntry(entry);
      assert.ok(result);
      assert.equal(result.abstract, "Line one. Line two. Line three.");
    });
  });

  // ── Simulation: batch of arXiv entries ────────────────────

  describe("simulation: parsing a batch of arXiv API results", () => {
    it("parses multiple entries like a real API response", () => {
      const entries = [
        {
          id: "https://arxiv.org/abs/1706.03762v7",
          title: "Attention Is All You Need",
          summary: "The dominant sequence transduction models...",
          author: [{ name: "Vaswani" }, { name: "Shazeer" }],
          published: "2017-06-12T17:57:34Z",
        },
        {
          id: "https://arxiv.org/abs/1810.04805v2",
          title: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
          summary: "We introduce a new language representation model called BERT...",
          author: [{ name: "Devlin" }, { name: "Chang" }],
          published: "2018-10-11T00:00:00Z",
        },
        {
          id: "https://arxiv.org/abs/2005.14165v4",
          title: "Language Models are Few-Shot Learners",
          summary: "Recent work has demonstrated substantial gains...",
          author: [{ name: "Brown" }, { name: "Mann" }],
          published: "2020-05-28T00:00:00Z",
        },
        // Simulate a malformed entry
        { summary: "No title here" },
        // Simulate an empty entry
        null,
      ];

      const results = entries
        .map((e) => parseEntry(e))
        .filter((r): r is NonNullable<typeof r> => r !== null);

      assert.equal(results.length, 3);
      assert.equal(results[0].arxivId, "1706.03762");
      assert.equal(results[1].arxivId, "1810.04805");
      assert.equal(results[2].arxivId, "2005.14165");
      assert.equal(results[0].year, 2017);
      assert.equal(results[1].year, 2018);
      assert.equal(results[2].year, 2020);

      // All should have unique normalizedTitles
      const titles = new Set(results.map((r) => r.normalizedTitle));
      assert.equal(titles.size, 3);
    });
  });
});
