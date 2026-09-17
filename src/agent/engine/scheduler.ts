import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { ScheduleConfig } from "@/db/schema";
import { computeNextRun } from "@/agent/schedule";
import { planAllowsLiveRuns, UPGRADE_MESSAGE } from "@/lib/billing";
import { executeAgent, type RunnerAgent } from "./runner";
import { notifyRunFinished } from "./notify";

const runningRuns = new Set<number>();
const MAX_CONCURRENT = Math.max(1, Number(process.env.RUN_MAX_CONCURRENT ?? 1));

const globalForCancel = globalThis as unknown as { __groovyRunCancel?: Set<number> };
const cancelledRuns = (globalForCancel.__groovyRunCancel ??= new Set<number>());

/** Signal an in-flight run to stop at the next step boundary. */
export function requestRunCancel(runId: number): void {
  cancelledRuns.add(runId);
}

export function isRunCancelled(runId: number): boolean {
  return cancelledRuns.has(runId);
}

/** True while this server process is actively executing the run. */
export function isRunActive(runId: number): boolean {
  return runningRuns.has(runId);
}

type SchedulerGlobal = {
  started?: boolean;
  interval?: ReturnType<typeof setInterval>;
};
const globalForScheduler = globalThis as unknown as {
  __groovyScheduler?: SchedulerGlobal;
};
const state: SchedulerGlobal = (globalForScheduler.__groovyScheduler ??= {});

/** Create the first scheduled row for a recurring agent. */
export async function insertFirstRunIfScheduled(agent: {
  agentId: string;
  userEmail: string | null;
  schedule: ScheduleConfig | null | undefined;
  timeZone?: string | null;
}): Promise<void> {
  if (!agent.schedule || agent.schedule.type !== "recurring") return;
  const schedule: ScheduleConfig = {
    ...agent.schedule,
    timeZone: agent.schedule.timeZone || agent.timeZone || "UTC",
  };
  const next = computeNextRun(schedule);
  if (!next) return;
  const db = await getDb();
  await db.insert(schema.agentRun).values({
    agentId: agent.agentId,
    userEmail: agent.userEmail,
    scheduleFor: next,
    timeZone: schedule.timeZone,
    status: "scheduled",
    trigger: "schedule",
  });
}

/** After a scheduled run finishes, queue the next occurrence. */
export async function insertNextRun(agent: {
  agentId: string;
  userEmail: string | null;
  schedule: ScheduleConfig | null | undefined;
  /** Compute the next occurrence after this date (defaults to now). */
  from?: Date;
}): Promise<void> {
  if (!agent.schedule || agent.schedule.type !== "recurring") return;
  const next = computeNextRun(agent.schedule, agent.from);
  if (!next) return;
  const db = await getDb();
  const existing = await db
    .select({ id: schema.agentRun.id })
    .from(schema.agentRun)
    .where(
      and(
        eq(schema.agentRun.agentId, agent.agentId),
        eq(schema.agentRun.status, "scheduled"),
        lte(schema.agentRun.scheduleFor, next),
      ),
    )
    .limit(1);
  if (existing[0]) return;
  await db.insert(schema.agentRun).values({
    agentId: agent.agentId,
    userEmail: agent.userEmail,
    scheduleFor: next,
    timeZone: agent.schedule.timeZone ?? "UTC",
    status: "scheduled",
    trigger: "schedule",
  });
}

/** Atomically claim due runs (safe against duplicate processing). */
export async function claimDueRuns(limit = 4): Promise<number[]> {
  const db = await getDb();
  const result = (await db.execute(sql`
    UPDATE agent_run
    SET status = 'queued', queued_at = (now() AT TIME ZONE 'UTC')
    WHERE id IN (
      SELECT id FROM agent_run
      WHERE (
        status = 'scheduled' AND schedule_for <= (now() AT TIME ZONE 'UTC')
      ) OR (
        status = 'queued' AND queued_at IS NOT NULL AND queued_at <= (now() AT TIME ZONE 'UTC') - interval '10 minutes'
      )
      ORDER BY schedule_for ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `)) as unknown as { rows?: Array<{ id: number }> } | Array<{ id: number }>;
  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  return rows.map((row) => Number(row.id));
}

/** Create a queued run and execute it in the background. */
export async function enqueueRun(options: {
  agentId: string;
  userEmail: string;
  trigger: "manual" | "chat";
  execute?: boolean;
}): Promise<number> {
  const db = await getDb();
  const rows = await db
    .insert(schema.agentRun)
    .values({
      agentId: options.agentId,
      userEmail: options.userEmail,
      scheduleFor: new Date(),
      timeZone: "UTC",
      status: "queued",
      trigger: options.trigger,
      queuedAt: new Date(),
    })
    .returning({ id: schema.agentRun.id });
  const runId = rows[0].id;
  if (options.execute !== false) {
    void executeRunById(runId).catch((error) => {
      console.error("[scheduler] run execution failed", runId, error);
    });
  }
  return runId;
}

/** Execute a single run by id, updating status/steps/output along the way. */
export async function executeRunById(runId: number): Promise<void> {
  if (runningRuns.has(runId)) return;
  runningRuns.add(runId);

  try {
    const db = await getDb();
    const runRows = await db
      .select()
      .from(schema.agentRun)
      .where(eq(schema.agentRun.id, runId))
      .limit(1);
    const run = runRows[0];
    if (!run) return;
    if (
      run.status === "completed" ||
      run.status === "running" ||
      run.status === "failed" ||
      run.status === "cancelled"
    ) {
      return;
    }

    const agentRows = await db
      .select()
      .from(schema.agentConfig)
      .where(eq(schema.agentConfig.agentId, run.agentId))
      .limit(1);
    const agent = agentRows[0];
    if (!agent) {
      await db
        .update(schema.agentRun)
        .set({
          status: "failed",
          error: "Agent configuration not found",
          completedAt: new Date(),
        })
        .where(eq(schema.agentRun.id, runId));
      return;
    }

    if (agent.status !== "active") {
      await db
        .update(schema.agentRun)
        .set({
          status: "failed",
          error: "Agent is paused",
          completedAt: new Date(),
        })
        .where(eq(schema.agentRun.id, runId));
      return;
    }

    // Credits + billing guard. Scheduled runs execute without a request
    // context, so the plan is read from the mirror in our users table.
    const userRows = await db
      .select({
        usageCredits: schema.users.usageCredits,
        plan: schema.users.plan,
        subscriptionStatus: schema.users.subscriptionStatus,
      })
      .from(schema.users)
      .where(eq(schema.users.email, run.userEmail ?? ""))
      .limit(1);
    const available = userRows[0]?.usageCredits ?? null;
    if (available !== null && available <= 0) {
      await db
        .update(schema.agentRun)
        .set({
          status: "failed",
          error: "No usage credits left. Upgrade your plan to keep running agents.",
          completedAt: new Date(),
        })
        .where(eq(schema.agentRun.id, runId));
      return;
    }
    if (!planAllowsLiveRuns(userRows[0]?.plan, userRows[0]?.subscriptionStatus)) {
      await db
        .update(schema.agentRun)
        .set({
          status: "failed",
          error: UPGRADE_MESSAGE,
          completedAt: new Date(),
        })
        .where(eq(schema.agentRun.id, runId));
      return;
    }

    await db
      .update(schema.agentRun)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(schema.agentRun.id, runId));

    const result = await executeAgent({
      userEmail: run.userEmail ?? "",
      agent: agent as unknown as RunnerAgent,
      input: agent.objective ?? "Complete the configured task",
      maxSteps: agent.maxSteps ?? 8,
      runId,
      shouldCancel: () => isRunCancelled(runId),
      onSteps: async (steps) => {
        const innerDb = await getDb();
        await innerDb
          .update(schema.agentRun)
          .set({ steps })
          .where(eq(schema.agentRun.id, runId));
      },
    });

    await db
      .update(schema.agentRun)
      .set({
        status: result.status,
        output: result.output,
        steps: result.steps,
        error: result.error ?? null,
        completedAt: new Date(),
      })
      .where(eq(schema.agentRun.id, runId));

    if (result.creditsUsed > 0 && run.userEmail) {
      await db
        .update(schema.users)
        .set({
          usageCredits: sql`GREATEST(COALESCE(${schema.users.usageCredits}, 0) - ${result.creditsUsed}, 0)`,
        })
        .where(eq(schema.users.email, run.userEmail));
    }

    // Instant "job finished" ping to Telegram (detached — a notification
    // failure must never fail or delay the run itself).
    void notifyRunFinished({
      runId,
      agentId: agent.agentId,
      userEmail: run.userEmail,
      status: result.status,
      output: result.output,
      error: result.error,
    }).catch((error) => {
      console.warn("[notify] telegram completion failed:", error);
    });

    if (run.trigger === "schedule") {
      await insertNextRun({
        agentId: agent.agentId,
        userEmail: agent.userEmail,
        schedule: agent.schedule,
      });
    }
  } finally {
    runningRuns.delete(runId);
    cancelledRuns.delete(runId);
  }
}

/** Claim and execute all currently due runs. */
export async function tick(): Promise<{ claimed: number; executed: number }> {
  const claimed = await claimDueRuns();
  const queue = claimed.filter((id) => !runningRuns.has(id));
  let executed = 0;

  const workers: Promise<void>[] = [];
  const take = async () => {
    while (queue.length > 0 && runningRuns.size < MAX_CONCURRENT) {
      const id = queue.shift();
      if (id === undefined) break;
      executed += 1;
      workers.push(executeRunById(id));
    }
  };
  await Promise.all([take(), take(), take()]);
  await Promise.allSettled(workers);
  return { claimed: claimed.length, executed };
}

/** Fail runs orphaned by a server restart or watchdog kill, and re-arm schedules. */
export async function recoverStaleRuns(olderThanMinutes = 10): Promise<number> {
  const db = await getDb();
  const result = (await db.execute(sql`
    UPDATE agent_run
    SET status = 'failed',
        error = 'Run interrupted (server restarted or execution timed out)',
        completed_at = (now() AT TIME ZONE 'UTC')
    WHERE status = 'running'
      AND started_at IS NOT NULL
      AND started_at <= (now() AT TIME ZONE 'UTC') - interval '1 minute' * ${olderThanMinutes}
    RETURNING id, agent_id, user_email, trigger
  `)) as unknown as
    | {
        rows?: Array<{
          id: number;
          agent_id?: string;
          user_email?: string;
          trigger?: string;
        }>;
      }
    | Array<{ id: number; agent_id?: string; user_email?: string; trigger?: string }>;
  const rows = Array.isArray(result) ? result : (result.rows ?? []);

  // Interrupted scheduled runs must not silently kill the recurring schedule:
  // queue the next occurrence for each affected active agent.
  for (const row of rows) {
    if (row.trigger !== "schedule" || !row.agent_id) continue;
    const agentRows = await db
      .select()
      .from(schema.agentConfig)
      .where(eq(schema.agentConfig.agentId, row.agent_id))
      .limit(1);
    const agent = agentRows[0];
    if (agent && agent.status === "active") {
      await insertNextRun({
        agentId: agent.agentId,
        userEmail: agent.userEmail,
        schedule: agent.schedule,
      });
    }
  }

  return rows.length;
}

/** Start the in-process scheduler (idempotent, guarded per server instance). */
export function startScheduler(): void {
  if (state.started) return;
  state.started = true;

  const run = async () => {
    try {
      await recoverStaleRuns();
      await tick();
    } catch (error) {
      console.error("[scheduler] tick failed:", error);
    }
  };

  setTimeout(run, 4000);
  state.interval = setInterval(run, 60_000);
  if (state.interval.unref) state.interval.unref();
  console.log("[scheduler] built-in scheduler started (tick every 60s)");
}

/** Next upcoming run for an agent (for the UI). */
export async function upcomingRunsForUser(userEmail: string, limit = 10) {
  const db = await getDb();
  return db
    .select()
    .from(schema.agentRun)
    .where(
      and(
        eq(schema.agentRun.userEmail, userEmail),
        eq(schema.agentRun.status, "scheduled"),
      ),
    )
    .orderBy(schema.agentRun.scheduleFor)
    .limit(limit);
}

/** Mark a run as cancelled (used by pause/delete flows). */
export async function cancelScheduledRuns(agentIds: string[]): Promise<void> {
  if (agentIds.length === 0) return;
  const db = await getDb();
  await db
    .update(schema.agentRun)
    .set({ status: "cancelled", completedAt: new Date() })
    .where(
      and(
        inArray(schema.agentRun.agentId, agentIds),
        eq(schema.agentRun.status, "scheduled"),
      ),
    );
}

/** Recent runs for an agent (used by chat context). */
export async function recentRuns(agentId: string, limit = 3) {
  const db = await getDb();
  return db
    .select()
    .from(schema.agentRun)
    .where(eq(schema.agentRun.agentId, agentId))
    .orderBy(desc(schema.agentRun.createdAt))
    .limit(limit);
}
