import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  getComposioAgentTools,
  integrationMode,
  isToolConnected,
} from "@/agent/integrations";
import { telegramChatIdFromSteps } from "@/agent/tools/telegram";
import { appUrl } from "@/lib/dodo";

/**
 * Failure alert for finished agent runs.
 *
 * Completed runs deliver their own deliverable through TELEGRAM_SEND_MESSAGE
 * as part of the run (see the auto-delivery in `@/agent/engine/runner`), so
 * there is intentionally no "run finished" message: the brief itself is the
 * notification. Failures have no deliverable, so they still ping here.
 */

function plainSummary(value: string | null | undefined): string {
  if (!value) return "";
  const stripped = value
    .replace(/[#>*_`|]|\!\[/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= 180) return stripped;
  const cut = stripped.slice(0, 180);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 108 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function formatDuration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export async function notifyRunFinished(input: {
  runId: number;
  agentId: string;
  userEmail: string | null;
  status: "completed" | "failed" | "cancelled";
  output?: string | null;
  error?: string | null;
  durationMs?: number | null;
}): Promise<void> {
  // Only failures need a message — the deliverable is sent by the run itself.
  if (input.status !== "failed") return;
  if (!input.userEmail) return;
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

  // Prefer the saved destination; fall back to the chat this agent last
  // delivered to and remember it.
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
      `[notify] failure alert skipped for ${agent.agentId}: no chat id known yet — set one in the agent settings`,
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

  const elapsed = input.durationMs ? ` (${formatDuration(input.durationMs)})` : "";
  const text = [
    `⚠️ Run failed — ${agent.name ?? "Agent"}${elapsed}`,
    plainSummary(input.error) || "The run failed — check the run log.",
    `${appUrl()}/dashboard/runs/${input.runId}`,
  ].join("\n");

  const result = (await composio.execute("TELEGRAM_SEND_MESSAGE", {
    chat_id: chatId,
    text,
  })) as { data?: { result?: { message_id?: unknown } } } | null;

  console.log(
    `[notify] run ${input.runId} failed: telegram alert sent to ${chatId} (message ${
      result?.data?.result?.message_id ?? "?"
    })`,
  );
}
