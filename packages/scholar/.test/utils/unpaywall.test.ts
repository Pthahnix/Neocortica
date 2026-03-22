import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// We mock global.fetch to test unpaywall parsing without network calls
const originalFetch = global.fetch;

describe("unpaywall", () => {
  const originalEmail = process.env.EMAIL;

  beforeEach(() => {
    process.env.EMAIL = "test@example.com";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.EMAIL = originalEmail;
  });

  it("throws if EMAIL is not set", async () => {
    delete process.env.EMAIL;
    // Re-import to get fresh module
    const { query } = await import("../../src/utils/unpaywall.js");
    await assert.rejects(() => query("10.1234/test"), /EMAIL not set/);
  });

  it("returns null when API returns non-200", async () => {
    global.fetch = async () => new Response(null, { status: 404 }) as any;
    const { query } = await import("../../src/utils/unpaywall.js");
    const result = await query("10.1234/notfound");
    assert.equal(result, null);
  });

  it("returns null when no OA PDF available", async () => {
    const apiResponse = {
      title: "Closed Access Paper",
      year: 2020,
      doi_url: "https://doi.org/10.1234/closed",
      best_oa_location: null,
      z_authors: [{ given: "John", family: "Doe" }],
    };
    global.fetch = async () =>
      new Response(JSON.stringify(apiResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }) as any;

    const { query } = await import("../../src/utils/unpaywall.js");
    const result = await query("10.1234/closed");
    assert.equal(result, null);
  });

  it("returns null when best_oa_location has no url_for_pdf", async () => {
    const apiResponse = {
      title: "No PDF Link Paper",
      year: 2021,
      doi_url: "https://doi.org/10.1234/nopdf",
      best_oa_location: { url: "https://example.com/page", url_for_pdf: null },
      z_authors: [{ given: "Jane", family: "Smith" }],
    };
    global.fetch = async () =>
      new Response(JSON.stringify(apiResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }) as any;

    const { query } = await import("../../src/utils/unpaywall.js");
    const result = await query("10.1234/nopdf");
    assert.equal(result, null);
  });

  it("parses a realistic OA paper response", async () => {
    const apiResponse = {
      title: "Attention Is All You Need",
      year: 2017,
      doi_url: "https://doi.org/10.48550/arXiv.1706.03762",
      best_oa_location: {
        url_for_pdf: "https://arxiv.org/pdf/1706.03762",
        url: "https://arxiv.org/abs/1706.03762",
        license: "cc-by",
      },
      z_authors: [
        { given: "Ashish", family: "Vaswani" },
        { given: "Noam", family: "Shazeer" },
        { given: "Niki", family: "Parmar" },
      ],
    };
    global.fetch = async () =>
      new Response(JSON.stringify(apiResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }) as any;

    const { query } = await import("../../src/utils/unpaywall.js");
    const result = await query("10.48550/arXiv.1706.03762");
    assert.ok(result);
    assert.equal(result.title, "Attention Is All You Need");
    assert.equal(result.normalizedTitle, "attention_is_all_you_need");
    assert.equal(result.doi, "10.48550/arXiv.1706.03762");
    assert.equal(result.year, 2017);
    assert.equal(result.oaPdfUrl, "https://arxiv.org/pdf/1706.03762");
    assert.equal(result.authors, "Ashish Vaswani, Noam Shazeer, Niki Parmar");
    assert.equal(result.sourceUrl, "https://doi.org/10.48550/arXiv.1706.03762");
  });

  it("handles author with only family name", async () => {
    const apiResponse = {
      title: "Some Paper",
      year: 2022,
      doi_url: "https://doi.org/10.1234/test",
      best_oa_location: {
        url_for_pdf: "https://example.com/paper.pdf",
      },
      z_authors: [
        { family: "Einstein" },
        { given: "Marie", family: "Curie" },
      ],
    };
    global.fetch = async () =>
      new Response(JSON.stringify(apiResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }) as any;

    const { query } = await import("../../src/utils/unpaywall.js");
    const result = await query("10.1234/test");
    assert.ok(result);
    assert.equal(result.authors, "Einstein, Marie Curie");
  });

  it("handles missing z_authors field", async () => {
    const apiResponse = {
      title: "No Authors Paper",
      year: 2023,
      doi_url: "https://doi.org/10.1234/noauth",
      best_oa_location: {
        url_for_pdf: "https://example.com/paper.pdf",
      },
    };
    global.fetch = async () =>
      new Response(JSON.stringify(apiResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }) as any;

    const { query } = await import("../../src/utils/unpaywall.js");
    const result = await query("10.1234/noauth");
    assert.ok(result);
    assert.equal(result.authors, undefined);
  });

  it("handles missing title in response", async () => {
    const apiResponse = {
      year: 2023,
      doi_url: "https://doi.org/10.1234/notitle",
      best_oa_location: {
        url_for_pdf: "https://example.com/paper.pdf",
      },
    };
    global.fetch = async () =>
      new Response(JSON.stringify(apiResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }) as any;

    const { query } = await import("../../src/utils/unpaywall.js");
    const result = await query("10.1234/notitle");
    assert.ok(result);
    assert.equal(result.title, "");
    assert.equal(result.normalizedTitle, "");
  });
});
