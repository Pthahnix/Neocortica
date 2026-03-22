import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normTitle } from "../../src/utils/misc.js";

describe("normTitle", () => {
  // Basic transformations
  it("lowercases and replaces non-alphanum with underscore", () => {
    assert.equal(normTitle("Hello World 2024"), "hello_world_2024");
  });

  it("strips .pdf suffix", () => {
    assert.equal(normTitle("paper.pdf"), "paper");
  });

  it("strips .PDF suffix (case insensitive)", () => {
    assert.equal(normTitle("paper.PDF"), "paper");
  });

  it("strips leading/trailing underscores", () => {
    assert.equal(normTitle("  --hello--  "), "hello");
  });

  it("collapses multiple underscores", () => {
    assert.equal(normTitle("a---b___c"), "a_b_c");
  });

  // Realistic paper titles
  it("normalizes a real arXiv paper title", () => {
    assert.equal(
      normTitle("Attention Is All You Need"),
      "attention_is_all_you_need",
    );
  });

  it("handles title with special characters and numbers", () => {
    assert.equal(
      normTitle("GPT-4: A Large Language Model (2023)"),
      "gpt_4_a_large_language_model_2023",
    );
  });

  it("handles title with colons and dashes", () => {
    assert.equal(
      normTitle("BERT: Pre-training of Deep Bidirectional Transformers"),
      "bert_pre_training_of_deep_bidirectional_transformers",
    );
  });

  it("handles unicode / non-ascii by stripping", () => {
    assert.equal(
      normTitle("Résumé of Müller's Über-Model"),
      "r_sum_of_m_ller_s_ber_model",
    );
  });

  // Edge cases
  it("returns empty string for empty input", () => {
    assert.equal(normTitle(""), "");
  });

  it("returns empty string for all-special-char input", () => {
    assert.equal(normTitle("---!!!---"), "");
  });

  it("handles very long title", () => {
    const longTitle = "A ".repeat(200) + "Paper";
    const result = normTitle(longTitle);
    assert.ok(result.startsWith("a_"));
    assert.ok(result.endsWith("_paper"));
  });

  it("handles filename-like input with .pdf", () => {
    assert.equal(normTitle("2301.12345v2.pdf"), "2301_12345v2");
  });

  // Dedup guarantee: same title variants produce same normalized form
  it("normalizes title variants to the same string", () => {
    const v1 = normTitle("Attention Is All You Need");
    const v2 = normTitle("attention is all you need");
    const v3 = normTitle("  Attention  Is  All  You  Need  ");
    assert.equal(v1, v2);
    assert.equal(v2, v3);
  });
});
