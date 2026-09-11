/**
 * Inspect Composio direct-tools session (telegram) and try to discover the
 * user's chat id for a real send test.
 * Usage: bun scripts/check-composio-tools.ts
 */
import { Composio, SessionPreset } from "@composio/core";

async function main() {
  const composio = new Composio();
  const userId = process.env.COMPOSIO_TEST_USER_ID || "demo@groovy.ai";
  const session = await composio.sessions.create(userId, {
    toolkits: ["telegram"],
    sessionPreset: SessionPreset.DIRECT_TOOLS,
  });
  const tools = await session.tools();
  const list = Array.isArray(tools) ? tools : ((tools as { items?: unknown[] }).items ?? []);
  const names = list.map((entry) => {
    const item = entry as Record<string, unknown>;
    const fn = (item.function ?? {}) as Record<string, unknown>;
    return String(item.slug ?? item.name ?? fn.name ?? "");
  });
  console.log("direct telegram tools:", names.length);
  console.log(names.join(", "));

  const updatesTool = names.find((name) => /GET_?UPDATES/i.test(name));
  if (updatesTool) {
    try {
      const updates = await session.execute(updatesTool, {});
      const text = JSON.stringify(updates);
      const chatIds = Array.from(
        new Set(
          Array.from(text.matchAll(/"id"\s*:\s*(-?\d{5,})/g)).map((match) => match[1]),
        ),
      );
      console.log("chat ids found:", chatIds.join(", ") || "(none)");
      if (chatIds.length === 0) {
        console.log("updates preview:", text.slice(0, 300));
      }
    } catch (error) {
      console.error("getUpdates failed:", error instanceof Error ? error.message : error);
    }
  } else {
    console.log("no get-updates tool exposed");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
