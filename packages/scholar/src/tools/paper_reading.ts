import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createReadingAgent, runAgents } from "../utils/agent.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load the three-pass reading prompt from prompt/paper-reading.md */
function loadReadingPrompt(): string {
  const promptPath = resolve(__dirname, "../../prompt/paper-reading.md");
  return readFileSync(promptPath, "utf-8");
}

export interface ReadingInput {
  papers: Array<{ markdownPath: string; title?: string }>;
  prompt?: string;
  batchSize?: number;
  concurrency?: number;
}

export interface ReadingResult {
  report: string;
  papers: string[];
}

/** paper_reading tool: three-pass reading via pi-agent-core. */
export async function paperReading(input: ReadingInput): Promise<ReadingResult[]> {
  const { papers, batchSize = 1, concurrency = 1 } = input;
  if (papers.length === 0) return [];

  const systemPrompt = input.prompt ?? loadReadingPrompt();

  // Group papers by batchSize
  const batches: typeof papers[] = [];
  for (let i = 0; i < papers.length; i += batchSize) {
    batches.push(papers.slice(i, i + batchSize));
  }

  // Create agent tasks
  const tasks = batches.map((batch) => ({
    run: async (): Promise<ReadingResult> => {
      const agent = createReadingAgent(systemPrompt);

      // Build user message: concatenate all papers in this batch
      const parts = batch.map((p) => {
        const content = readFileSync(p.markdownPath, "utf-8");
        const title = p.title ?? p.markdownPath;
        return `--- Paper: ${title} ---\n\n${content}`;
      });
      const userMessage = parts.join("\n\n---\n\n");

      await agent.prompt(userMessage);

      // Extract the report from agent's last assistant message
      const messages = agent.state.messages;
      const lastAssistant = [...messages].reverse().find((m: any) => m.role === "assistant");
      const report = (lastAssistant as any)?.content
        ?.filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("") ?? "";

      return {
        report,
        papers: batch.map((p) => p.title ?? p.markdownPath),
      };
    },
  }));

  return runAgents(tasks, concurrency);
}
