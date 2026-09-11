/**
 * Send a real Telegram message through the app's Composio project connection.
 * Usage: bun scripts/send-telegram-test.ts [chatId]
 */
import { Composio, SessionPreset } from "@composio/core";

async function main() {
  const composio = new Composio();
  const userId = process.env.COMPOSIO_TEST_USER_ID || "demo@groovy.ai";
  const session = await composio.sessions.create(userId, {
    toolkits: ["telegram"],
    sessionPreset: SessionPreset.DIRECT_TOOLS,
  });

  // Find the chat id from recent updates when not provided.
  let chatId: string | undefined = process.argv[2];
  if (!chatId) {
    const updates = await session.execute("TELEGRAM_GET_UPDATES", {});
    const text = JSON.stringify(updates);
    const matches = Array.from(text.matchAll(/"chat"\s*:\s*\{[^}]*?"id"\s*:\s*(-?\d+)/g));
    chatId = matches[0]?.[1];
    if (!chatId) {
      const anyId = text.match(/"id"\s*:\s*(-?\d{6,})/);
      chatId = anyId?.[1];
    }
  }
  if (!chatId) throw new Error("No chat id found — message the bot first");

  const result = await session.execute("TELEGRAM_SEND_MESSAGE", {
    chat_id: chatId,
    text:
      "✅ Groovy AI — Telegram connection verified.\n\n" +
      "This message was sent by your Groovy AI agent engine through Composio " +
      `on ${new Date().toUTCString()}. Your agents can now deliver results here.`,
  });

  const raw = result as Record<string, unknown>;
  const data = (raw.data ?? raw) as Record<string, unknown>;
  console.log("chat_id:", chatId);
  console.log("logId:", raw.logId ?? raw.log_id ?? "(none)");
  console.log("successful:", raw.successful ?? true);
  console.log("response:", JSON.stringify(data).slice(0, 400));
}

main().catch((error) => {
  console.error("FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
