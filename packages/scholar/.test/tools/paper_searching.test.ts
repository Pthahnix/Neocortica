import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { parseScholarItem, enrichMeta } from "../../src/tools/paper_searching.js";
import type { ScholarItem } from "../../src/types.js";
import type { PaperMeta } from "../../src/types.js";

const originalFetch = global.fetch;

describe("paper_searching", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ── parseScholarItem (pure function) ────────────────────────

  describe("parseScholarItem", () => {
    it("parses a realistic Google Scholar item with arXiv link", () => {
      const item: ScholarItem = {
        title: "Attention Is All You Need",
        link: "https://arxiv.org/abs/1706.03762",
        authors: "A Vaswani, N Shazeer, N Parmar",
        year: "2017",
        citations: "95000",
        searchMatch: "The dominant sequence transduction models are based on complex recurrent...",
        documentLink: "https://arxiv.org/pdf/1706.03762",
      };

      const meta = parseScholarItem(item);
      assert.equal(meta.title, "Attention Is All You Need");
      assert.equal(meta.normalizedTitle, "attention_is_all_you_need");
      assert.equal(meta.arxivId, "1706.03762");
      assert.equal(meta.arxivUrl, "https://arxiv.org/abs/1706.03762");
      assert.equal(meta.year, 2017);
      assert.equal(meta.authors, "A Vaswani, N Shazeer, N Parmar");
      assert.equal(meta.citationCount, 95000);
      assert.equal(meta.abstract, "The dominant sequence transduction models are based on complex recurrent...");
      assert.equal(meta.oaPdfUrl, undefined, "documentLink must NOT become oaPdfUrl");
      assert.equal(meta.sourceUrl, "https://arxiv.org/abs/1706.03762");
    });

    it("parses item without arXiv link", () => {
      const item: ScholarItem = {
        title: "Some Conference Paper",
        link: "https://dl.acm.org/doi/10.1145/12345",
        authors: "J Smith, K Jones",
        year: "2022",
        citations: "50",
        searchMatch: "We present a novel approach...",
      };

      const meta = parseScholarItem(item);
      assert.equal(meta.title, "Some Conference Paper");
      assert.equal(meta.arxivId, undefined);
      assert.equal(meta.arxivUrl, undefined);
      assert.equal(meta.year, 2022);
      assert.equal(meta.citationCount, 50);
      assert.equal(meta.sourceUrl, "https://dl.acm.org/doi/10.1145/12345");
    });

    it("handles year as number", () => {
      const item: ScholarItem = { title: "Paper", year: 2023 };
      const meta = parseScholarItem(item);
      assert.equal(meta.year, 2023);
    });

    it("handles year with extra text like '… - 2024 - Springer'", () => {
      const item: ScholarItem = { title: "Paper", year: "… - 2024 - Springer" };
      const meta = parseScholarItem(item);
      assert.equal(meta.year, 2024);
    });

    it("handles citations as number", () => {
      const item: ScholarItem = { title: "Paper", citations: 42 };
      const meta = parseScholarItem(item);
      assert.equal(meta.citationCount, 42);
    });

    it("handles citations as string '0'", () => {
      const item: ScholarItem = { title: "Paper", citations: "0" };
      const meta = parseScholarItem(item);
      assert.equal(meta.citationCount, 0);
    });

    it("handles completely empty item", () => {
      const item: ScholarItem = {};
      const meta = parseScholarItem(item);
      assert.equal(meta.title, "");
      assert.equal(meta.normalizedTitle, "");
      assert.equal(meta.arxivId, undefined);
      assert.equal(meta.year, undefined);
      assert.equal(meta.authors, undefined);
      assert.equal(meta.citationCount, undefined);
    });

    it("handles item with only title", () => {
      const item: ScholarItem = { title: "Minimal Paper" };
      const meta = parseScholarItem(item);
      assert.equal(meta.title, "Minimal Paper");
      assert.equal(meta.normalizedTitle, "minimal_paper");
    });

    it("extracts arXiv ID from pdf URL in link", () => {
      const item: ScholarItem = {
        title: "Paper",
        link: "https://arxiv.org/pdf/2301.12345v2",
      };
      const meta = parseScholarItem(item);
      assert.equal(meta.arxivId, "2301.12345");
      assert.equal(meta.arxivUrl, "https://arxiv.org/abs/2301.12345");
    });
  });

  // ── enrichMeta — pipeline: ① arxivUrl? ② arXiv search ③ SS ④ Unpaywall ──

  describe("enrichMeta — pipeline order: arxiv > SS > Unpaywall", () => {
    it("step ①: returns immediately when arxivUrl already present", async () => {
      let fetchCalled = false;
      global.fetch = async () => {
        fetchCalled = true;
        return new Response(null, { status: 404 });
      };

      const meta: PaperMeta = {
        title: "Test",
        normalizedTitle: "test",
        arxivId: "2001.00001",
        arxivUrl: "https://arxiv.org/abs/2001.00001",
      };
      const result = await enrichMeta(meta);
      assert.equal(result.arxivUrl, "https://arxiv.org/abs/2001.00001");
      assert.equal(fetchCalled, false, "no fetch when arxivUrl already set");
    });

    it("step ②: finds paper via arXiv title search, skips SS", async () => {
      const calls: string[] = [];
      global.fetch = async (url: any) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        calls.push(urlStr);
        if (urlStr.includes("export.arxiv.org")) {
          return new Response(`<?xml version="1.0"?>
            <feed><entry>
              <id>http://arxiv.org/abs/2001.00001v1</id>
              <title>Test Paper Title</title>
              <summary>Abstract here</summary>
              <author><name>Author X</name></author>
              <published>2020-01-01T00:00:00Z</published>
            </entry></feed>`, { status: 200, headers: { "Content-Type": "application/xml" } });
        }
        return new Response(null, { status: 404 });
      };

      const meta: PaperMeta = { title: "Test Paper Title", normalizedTitle: "test_paper_title" };
      const result = await enrichMeta(meta);
      assert.equal(result.arxivId, "2001.00001");
      assert.equal(result.arxivUrl, "https://arxiv.org/abs/2001.00001");
      assert.equal(result.abstract, "Abstract here");
      // SS should NOT have been called
      assert.ok(!calls.some(u => u.includes("semanticscholar.org")), "SS should not be called when arXiv succeeds");
    });

    it("step ③: falls through to SS when arXiv search fails", async () => {
      global.fetch = async (url: any) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("export.arxiv.org")) {
          return new Response(`<?xml version="1.0"?><feed></feed>`, { status: 200 });
        }
        if (urlStr.includes("semanticscholar.org")) {
          return new Response(JSON.stringify({
            data: [{
              paperId: "ss123",
              title: "Non-arXiv Paper",
              year: 2021,
              authors: [{ name: "Author Y" }],
              abstract: "Abstract",
              citationCount: 50,
              externalIds: { DOI: "10.1234/test" },
              openAccessPdf: { url: "https://example.com/paper.pdf" },
              url: "https://semanticscholar.org/paper/ss123",
            }],
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return new Response(null, { status: 404 });
      };

      const meta: PaperMeta = { title: "Non-arXiv Paper", normalizedTitle: "non_arxiv_paper" };
      const result = await enrichMeta(meta);
      assert.equal(result.s2Id, "ss123");
      assert.equal(result.doi, "10.1234/test");
      assert.equal(result.oaPdfUrl, "https://example.com/paper.pdf");
      assert.equal(result.arxivUrl, undefined, "no arXiv found");
    });

    it("step ③→return: SS finds arXiv ID in externalIds, skips Unpaywall", async () => {
      const calls: string[] = [];
      global.fetch = async (url: any) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        calls.push(urlStr);
        if (urlStr.includes("export.arxiv.org")) {
          return new Response(`<?xml version="1.0"?><feed></feed>`, { status: 200 });
        }
        if (urlStr.includes("semanticscholar.org")) {
          return new Response(JSON.stringify({
            data: [{
              paperId: "ss456",
              title: "Paper With ArXiv In SS",
              year: 2022,
              authors: [{ name: "Z" }],
              externalIds: { ArXiv: "2201.00001", DOI: "10.1234/x" },
              url: "https://semanticscholar.org/paper/ss456",
            }],
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return new Response(null, { status: 404 });
      };

      const meta: PaperMeta = { title: "Paper With ArXiv In SS", normalizedTitle: "paper_with_arxiv_in_ss" };
      const result = await enrichMeta(meta);
      assert.equal(result.arxivId, "2201.00001");
      assert.ok(result.arxivUrl?.includes("2201.00001"));
      // Unpaywall should NOT be called
      assert.ok(!calls.some(u => u.includes("unpaywall.org")), "Unpaywall should not be called when arXiv found via SS");
    });

    it("step ④: SS has DOI but no oaPdfUrl, queries Unpaywall", async () => {
      process.env.EMAIL = "test@example.com";
      global.fetch = async (url: any) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("export.arxiv.org")) {
          return new Response(`<?xml version="1.0"?><feed></feed>`, { status: 200 });
        }
        if (urlStr.includes("semanticscholar.org")) {
          return new Response(JSON.stringify({
            data: [{
              paperId: "ss789",
              title: "Paywalled Paper",
              externalIds: { DOI: "10.9999/paywall" },
            }],
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        if (urlStr.includes("unpaywall.org")) {
          return new Response(JSON.stringify({
            best_oa_location: { url_for_pdf: "https://oa.example.com/paper.pdf" },
            title: "Paywalled Paper",
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return new Response(null, { status: 404 });
      };

      const meta: PaperMeta = { title: "Paywalled Paper", normalizedTitle: "paywalled_paper" };
      const result = await enrichMeta(meta);
      assert.equal(result.oaPdfUrl, "https://oa.example.com/paper.pdf");
    });

    it("does not overwrite existing fields with SS data", async () => {
      global.fetch = async (url: any) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("export.arxiv.org")) {
          return new Response(`<?xml version="1.0"?><feed></feed>`, { status: 200 });
        }
        if (urlStr.includes("semanticscholar.org")) {
          return new Response(JSON.stringify({
            data: [{
              paperId: "ss_id_456",
              title: "Test Paper",
              year: 2020,
              authors: [{ name: "SS Author" }],
              abstract: "SS abstract",
              externalIds: {},
            }],
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return new Response(null, { status: 404 });
      };

      const meta: PaperMeta = {
        title: "Test Paper",
        normalizedTitle: "test_paper",
        year: 2021,
        authors: "Original",
        abstract: "Original abstract",
      };
      const result = await enrichMeta(meta);
      assert.equal(result.year, 2021);
      assert.equal(result.authors, "Original");
      assert.equal(result.abstract, "Original abstract");
      assert.equal(result.s2Id, "ss_id_456");
    });

    it("returns minimal meta when all APIs fail", async () => {
      global.fetch = async () => new Response(null, { status: 500 });
      const meta: PaperMeta = { title: "Unknown", normalizedTitle: "unknown" };
      const result = await enrichMeta(meta);
      assert.equal(result.title, "Unknown");
      assert.equal(result.arxivUrl, undefined);
      assert.equal(result.s2Id, undefined);
    });
  });

  // ── Simulation: batch of Scholar results ────────────────────

  describe("simulation: parsing a batch of Google Scholar results", () => {
    it("parses 5 realistic Google Scholar items", () => {
      const items: ScholarItem[] = [
        {
          title: "Attention Is All You Need",
          link: "https://arxiv.org/abs/1706.03762",
          authors: "A Vaswani, N Shazeer, N Parmar, J Uszkoreit, L Jones, AN Gomez",
          year: "2017",
          citations: "95000",
          searchMatch: "The dominant sequence transduction models...",
          documentLink: "https://arxiv.org/pdf/1706.03762",
        },
        {
          title: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
          link: "https://arxiv.org/abs/1810.04805",
          authors: "J Devlin, MW Chang, K Lee, K Toutanova",
          year: "2018",
          citations: "65000",
          searchMatch: "We introduce a new language representation model...",
        },
        {
          title: "A Survey on Deep Learning",
          link: "https://www.sciencedirect.com/science/article/pii/S0893608014002135",
          authors: "Y LeCun, Y Bengio, G Hinton",
          year: "2015",
          citations: "45000",
          searchMatch: "Deep learning allows computational models...",
          documentLink: "https://www.cs.toronto.edu/~hinton/absps/NatureDeepReview.pdf",
        },
        {
          title: "ImageNet Classification with Deep Convolutional Neural Networks",
          link: "https://papers.nips.cc/paper/4824",
          authors: "A Krizhevsky, I Sutskever, GE Hinton",
          year: "2012",
          citations: "110000",
        },
        {
          title: "Some Obscure Paper",
        },
      ];

      const results = items.map(parseScholarItem);
      assert.equal(results.length, 5);
      assert.equal(results[0].arxivId, "1706.03762");
      assert.equal(results[1].arxivId, "1810.04805");
      assert.equal(results[2].arxivId, undefined);
      assert.equal(results[2].oaPdfUrl, undefined);
      assert.equal(results[3].oaPdfUrl, undefined);
      assert.equal(results[3].citationCount, 110000);
      assert.equal(results[4].title, "Some Obscure Paper");
      assert.equal(results[4].year, undefined);

      for (const r of results) {
        assert.ok(typeof r.normalizedTitle === "string");
      }
      const uniqueTitles = new Set(results.map((r) => r.normalizedTitle));
      assert.equal(uniqueTitles.size, 5);
    });
  });
});
