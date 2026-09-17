import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { ScheduleConfig } from "@/db/schema";
import {
  cancelScheduledRuns,
  insertFirstRunIfScheduled,
  insertNextRun,
} from "@/agent/engine/scheduler";

export interface AgentUpdateInput {
  name?: string;
  agentImage?: string;
  description?: string;
  objective?: string;
  instructions?: string;
  tools?: string[];
  skills?: string[];
  outputFormat?: string;
  telegramChatId?: string | null;
  status?: "active" | "paused";
  schedule?: ScheduleConfig;
}

export async function getOwnedAgent(userEmail: string, agentId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.agentConfig)
    .where(
      and(
        eq(schema.agentConfig.agentId, agentId),
        eq(schema.agentConfig.userEmail, userEmail),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Update an agent and keep the run queue consistent:
 *  - pausing cancels upcoming runs
 *  - resuming cancels + re-inserts the next occurrence
 *  - changing a schedule re-queues the next occurrence
 */
export async function updateOwnedAgent(
  userEmail: string,
  agentId: string,
  changes: AgentUpdateInput,
): Promise<
  | { agent: typeof schema.agentConfig.$inferSelect; error?: undefined }
  | { error: string; agent?: undefined }
> {
  const previous = await getOwnedAgent(userEmail, agentId);
  if (!previous) return { error: "Agent not found" as const };

  const db = await getDb();
  const scheduleChanged =
    changes.schedule !== undefined &&
    JSON.stringify(changes.schedule) !== JSON.stringify(previous.schedule);

  const updated = await db
    .update(schema.agentConfig)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(schema.agentConfig.agentId, agentId))
    .returning();

  const schedule = (changes.schedule ?? previous.schedule) as ScheduleConfig | null;

  if (changes.status === "paused") {
    await cancelScheduledRuns([agentId]);
  } else if (changes.status === "active") {
    await cancelScheduledRuns([agentId]);
    await insertFirstRunIfScheduled({
      agentId,
      userEmail,
      schedule,
      timeZone: schedule?.timeZone,
    });
  } else if (scheduleChanged) {
    await cancelScheduledRuns([agentId]);
    await insertNextRun({ agentId, userEmail, schedule });
  }

  return { agent: updated[0] };
}

export async function deleteOwnedAgent(
  userEmail: string,
  agentId: string,
): Promise<{ success: true; error?: undefined } | { error: string; success?: undefined }> {
  const agent = await getOwnedAgent(userEmail, agentId);
  if (!agent) return { error: "Agent not found" as const };
  const db = await getDb();
  await cancelScheduledRuns([agentId]);
  await db.delete(schema.agentConfig).where(eq(schema.agentConfig.agentId, agentId));
  return { success: true };
}
