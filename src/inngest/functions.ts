import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { executeRunById } from "@/agent/engine/scheduler";
import { inngest, RUN_EXECUTE_EVENT } from "./client";

/**
 * Background scheduling — mirrors the tutorial's two Inngest functions.
 *
 *  1. `processScheduledAgentRun` — cron every 5 minutes: finds runs due within
 *     the next hour, marks them `queued` (idempotent) and emits an event.
 *  2. `executeScheduledAgentRun` — waits until the exact `scheduleFor` time and
 *     executes the agent via the shared engine.
 *
 * The platform also ships an in-process scheduler fallback, so scheduled runs
 * still fire when the Inngest dev server / cloud is not connected.
 */

export const processScheduledAgentRun = inngest.createFunction(
  { id: "process-scheduled-agent-run", retries: 2, triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => {
    const due = await step.run("find-upcoming-runs", async () => {
      const db = await getDb();
      const now = new Date();
      const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
      const rows = await db
        .select({ id: schema.agentRun.id })
        .from(schema.agentRun)
        .where(
          and(
            eq(schema.agentRun.status, "scheduled"),
            gte(schema.agentRun.scheduleFor, now),
            lte(schema.agentRun.scheduleFor, nextHour),
          ),
        )
        .limit(50);
      return rows.map((row) => row.id);
    });

    const queued: number[] = [];
    for (const runId of due) {
      const claimed = await step.run(`queue-${runId}`, async () => {
        const db = await getDb();
        const result = (await db.execute(sql`
          UPDATE agent_run SET status = 'queued', queued_at = (now() AT TIME ZONE 'UTC')
          WHERE id = ${runId} AND status = 'scheduled'
          RETURNING id
        `)) as unknown as { rows?: Array<{ id: number }> };
        return (result.rows ?? []).length > 0;
      });
      if (claimed) {
        queued.push(runId);
        await step.sendEvent(`send-to-execute-${runId}`, {
          name: RUN_EXECUTE_EVENT,
          data: { runId },
        });
      }
    }

    return { checked: due.length, queued };
  },
);

export const executeScheduledAgentRun = inngest.createFunction(
  {
    id: "execute-scheduled-agent-run",
    retries: 1,
    concurrency: 4,
    triggers: [{ event: RUN_EXECUTE_EVENT }],
  },
  async ({ event, step }) => {
    const runId = Number((event.data as { runId?: number }).runId);
    if (!runId) throw new Error("runId missing from event");

    const run = await step.run("load-run", async () => {
      const db = await getDb();
      const rows = await db
        .select()
        .from(schema.agentRun)
        .where(eq(schema.agentRun.id, runId))
        .limit(1);
      return rows[0] ?? null;
    });

    if (!run || run.status !== "queued") {
      return { runId, skipped: true };
    }

    const scheduleFor = new Date(run.scheduleFor);
    if (scheduleFor.getTime() > Date.now() + 1000) {
      await step.sleepUntil("wait-for-scheduled-time", scheduleFor);
    }

    await step.run("execute-agent-run", async () => {
      await executeRunById(runId);
    });

    return { runId };
  },
);

export const inngestFunctions = [processScheduledAgentRun, executeScheduledAgentRun];
