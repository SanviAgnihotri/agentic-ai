/**
 * Quick check of the configured LLM provider (tool-calling + structured output).
 * Usage: bun scripts/check-llm.ts
 */
import { z } from "zod";
import { getLlm } from "../src/agent/ai/llm";

async function main() {
  const llm = getLlm();
  console.log(`provider=${llm.id} model=${llm.model}`);

  const structured = await llm.generateObject({
    system: "You extract structured data. Reply with JSON only.",
    prompt: "Extract the product name and price from: 'The Groovy Plan costs $12 per month.'",
    schema: z.object({ product: z.string(), price: z.number() }),
    schemaName: "product_extract",
    mockContext: { kind: "briefing" },
  });
  console.log("generateObject OK:", JSON.stringify(structured));

  const chat = await llm.chatWithTools({
    system: "You are a helpful tool-calling agent. Use the tool when asked for the weather.",
    messages: [{ role: "user", content: "What is the weather in Mumbai? Use the tool." }],
    tools: [
      {
        name: "get_weather",
        description: "Get current weather for a city",
        parameters: z.object({ city: z.string().describe("City name") }),
      },
    ],
    mockContext: { kind: "execute" },
  });
  console.log("chatWithTools result:", JSON.stringify(chat).slice(0, 300));
}

main().catch((error) => {
  console.error("FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
