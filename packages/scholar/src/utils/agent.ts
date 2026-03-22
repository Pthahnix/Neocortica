import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";

/** Create a paper-reading Agent with the given system prompt. Uses OpenRouter config from .env. */
export function createReadingAgent(systemPrompt: string): Agent {
  const modelName = process.env.OPENAI_MODEL ?? "openai/gpt-oss-120b";
  const model = getModel("openrouter", modelName as any);

  return new Agent({
    initialState: {
      systemPrompt,
      model,
    },
    getApiKey: () => process.env.OPENAI_API_KEY ?? "",
  });
}

export interface AgentTask<T> {
  run: () => Promise<T>;
}

/** Run tasks with concurrency control. Returns results in original order. */
export async function runAgents<T>(tasks: AgentTask<T>[], concurrency: number): Promise<T[]> {
  if (tasks.length === 0) return [];

  const results = new Array<T>(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      results[i] = await tasks[i].run();
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
