import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createReadingAgent, runAgents } from "../../src/utils/agent.js";

describe("agent", () => {
  describe("createReadingAgent", () => {
    it("creates an Agent with given system prompt", () => {
      const agent = createReadingAgent("You are a reader.");
      assert.ok(agent);
      assert.equal(agent.state.systemPrompt, "You are a reader.");
    });

    it("uses model from env config", () => {
      const original = process.env.OPENAI_MODEL;
      process.env.OPENAI_MODEL = "openai/gpt-4o";
      try {
        const agent = createReadingAgent("Prompt");
        assert.ok(agent.state.model);
        assert.equal(agent.state.model.id, "openai/gpt-4o");
      } finally {
        if (original !== undefined) {
          process.env.OPENAI_MODEL = original;
        } else {
          delete process.env.OPENAI_MODEL;
        }
      }
    });

    it("defaults to openai/gpt-oss-120b when env not set", () => {
      const original = process.env.OPENAI_MODEL;
      delete process.env.OPENAI_MODEL;
      try {
        const agent = createReadingAgent("Prompt");
        assert.equal(agent.state.model.id, "openai/gpt-oss-120b");
      } finally {
        if (original !== undefined) {
          process.env.OPENAI_MODEL = original;
        }
      }
    });
  });

  describe("runAgents", () => {
    it("returns results in order with concurrency 1", async () => {
      const order: number[] = [];
      const tasks = [0, 1, 2].map((i) => ({
        run: async () => {
          order.push(i);
          return `result-${i}`;
        },
      }));
      const results = await runAgents(tasks, 1);
      assert.deepEqual(results, ["result-0", "result-1", "result-2"]);
      assert.deepEqual(order, [0, 1, 2]);
    });

    it("runs tasks in parallel with concurrency > 1", async () => {
      let concurrent = 0;
      let maxConcurrent = 0;
      const tasks = Array.from({ length: 4 }, (_, i) => ({
        run: async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((r) => setTimeout(r, 50));
          concurrent--;
          return `r${i}`;
        },
      }));
      const results = await runAgents(tasks, 2);
      assert.equal(results.length, 4);
      assert.ok(maxConcurrent <= 2, `max concurrent was ${maxConcurrent}`);
    });

    it("handles empty task list", async () => {
      const results = await runAgents([], 3);
      assert.deepEqual(results, []);
    });
  });
});
