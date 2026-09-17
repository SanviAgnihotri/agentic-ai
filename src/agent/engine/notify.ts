import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  getComposioAgentTools,
  integrationMode,
  isToolConnected,
} from "@/agent/integrations";
import type { RunStep } from "@/db/schema";
import { appUrl } from "@/lib/dodo";

/**
 * Instant Telegram notification when an agent run finishes.
 *
 * Runs outside the agent's own tool loop, right after the run row is
 * finalized, so the user hears about completed/failed jobs even when the
 * model never chose to send a message itself.
 *
 * The target chat is the one the agent most recently sent to (any earlier
 * run), so the ping always lands in the conversation the user already reads.
 * Only fires when Telegram is part of the agent AND actually connected — and
 * never in demo mode, where no message could leave the app.
 */

const SUMMARY_MAX = 160;

function plainSummary(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/[#>*_`|]|\!\[/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SUMMARY_MAX);
}

function telegramChatIdFromSteps(steps: RunStep[] | null | undefined): string | null {
  if (!Array.isArray(steps)) return null;
  for (const step of [...steps].reverse()) {
    if (step?.type !== "tool_result") continue;
    if (step.toolSlug?.toUpperCase() !== "TELEGRAM_SEND_MESSAGE") continue;
    const output = step.output as Record<string, unknown> | undefined;
    const chatId = output?.chat_id;
    if (typeof chatId === "string" && chatId.trim()) return chatId.trim();
    if (typeof chatId === "number") return String(chatId);
  }
  return null;
}

export async function notifyRunFinished(input: {
  runId: number;
  agentId: string;
  userEmail: string | null;
  status: "completed" | "failed" | "cancelled";
  output?: string | null;
  error?: string | null;
}): Promise<void> {
  // Cancelled runs are user-initiated; no ping needed. Demo mode cannot
  // deliver anything (and must not pretend it did).
  if (!input.userEmail || input.status === "cancelled") return;
  if (integrationMode() !== "composio") return;

  const db = await getDb();
  const agentRows = await db
    .select()
    .from(schema.agentConfig)
    .where(eq(schema.agentConfig.agentId, input.agentId))
    .limit(1);
  const agent = agentRows[0];
  if (!agent) return;
  if (!(agent.tools ?? []).includes("telegram")) return;
  if (!(await isToolConnected(input.userEmail, "telegram"))) return;

  // Prefer the saved destination; fall back to the chat this agent last sent
  // to and remember it, so notifications never depend on a send happening
  // first in the very same run.
  let chatId = agent.telegramChatId?.trim() || null;
  if (!chatId) {
    const recent = await db
      .select({ steps: schema.agentRun.steps })
      .from(schema.agentRun)
      .where(
        and(
          eq(schema.agentRun.agentId, input.agentId),
          inArray(schema.agentRun.status, ["completed", "failed"]),
        ),
      )
      .orderBy(desc(schema.agentRun.createdAt))
      .limit(12);
    for (const row of recent) {
      chatId = telegramChatIdFromSteps(row.steps);
      if (chatId) break;
    }
    if (chatId) {
      await db
        .update(schema.agentConfig)
        .set({ telegramChatId: chatId, updatedAt: new Date() })
        .where(eq(schema.agentConfig.id, agent.id));
    }
  }
  if (!chatId) {
    console.warn(
      `[notify] telegram completion skipped for ${agent.agentId}: no chat id known yet — set one in the agent settings`,
    );
    return;
  }

  const composio = await getComposioAgentTools({
    userEmail: input.userEmail,
    agentId: input.agentId,
    toolkitSlugs: ["telegram"],
    sessionId: agent.composioSessionId,
  });
  if (!composio) return;

  const headline =
    input.status === "completed" ? "✅ Run finished" : "⚠️ Run failed";
  const detail =
    input.status === "failed"
      ? plainSummary(input.error) || plainSummary(input.output)
      : plainSummary(input.output);
  const text = [
    `${headline} — ${agent.name ?? "Agent"}`,
    detail || (input.status === "failed" ? "The run failed — check the run log." : "Deliverable ready."),
    `${appUrl()}/dashboard/runs/${input.runId}`,
  ].join("\n");

  const result = (await composio.execute("TELEGRAM_SEND_MESSAGE", {
    chat_id: chatId,
    text,
  })) as { data?: { result?: { message_id?: unknown } } } | null;

  console.log(
    `[notify] run ${input.runId} ${input.status}: telegram completion sent to ${chatId} (message ${
      result?.data?.result?.message_id ?? "?"
    })`,
  );
}
