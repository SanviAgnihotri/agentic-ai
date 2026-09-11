import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { InferSelectModel } from "drizzle-orm";
import { errorResponse, requireApiUser } from "@/lib/api";
import {
  insertNextRun,
  isRunActive,
  requestRunCancel,
} from "@/agent/engine/scheduler";

export const runtime = "nodejs";

type Context = { params: Promise<{ runId: string }> };
type AgentRunRow = InferSelectModel<typeof schema.agentRun>;

/**
 * Keep recurring schedules alive after a run is skipped or stopped by hand:
 * queue the occurrence after the cancelled one.
 */
async function rearmSchedule(
  db: Awaited<ReturnType<typeof getDb>>,
  run: AgentRunRow,
): Promise<void> {
  if (run.trigger !== "schedule") return;
  const agentRows = await db
    .select()
    .from(schema.agentConfig)
    .where(eq(schema.agentConfig.agentId, run.agentId))
    .limit(1);
  const agent = agentRows[0];
  if (agent && agent.status === "active") {
    await insertNextRun({
      agentId: agent.agentId,
      userEmail: agent.userEmail,
      schedule: agent.schedule,
      from: new Date(new Date(run.scheduleFor).getTime() + 60_000),
    });
  }
}

/**
 * Stop a run:
 *  - actively running here → signal the engine (stops at the next step)
 *  - orphaned running run  → mark cancelled directly (engine died with a restart)
 *  - queued / scheduled    → cancel before execution and re-arm the schedule
 */
export async function POST(_request: Request, context: Context) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { runId } = await context.params;
  const id = Number(runId);
  if (!Number.isFinite(id)) return errorResponse("Invalid run id", 400);

  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.agentRun)
      .where(and(eq(schema.agentRun.id, id), eq(schema.agentRun.userEmail, user.email)))
      .limit(1);
    const run = rows[0];
    if (!run) return errorResponse("Run not found", 404);

    if (run.status === "running") {
      if (isRunActive(id)) {
        requestRunCancel(id);
        return NextResponse.json({ cancelled: true, status: "stopping" });
      }
      // The engine for this run is gone (server restarted mid-run).
      await db
        .update(schema.agentRun)
        .set({
          status: "cancelled",
          error: "Cancelled by user",
          completedAt: new Date(),
        })
        .where(eq(schema.agentRun.id, id));
      await rearmSchedule(db, run);
      return NextResponse.json({ cancelled: true, status: "cancelled" });
    }

    if (run.status === "queued" || run.status === "scheduled") {
      requestRunCancel(id);
      await db
        .update(schema.agentRun)
        .set({
          status: "cancelled",
          error: "Cancelled by user",
          completedAt: new Date(),
        })
        .where(eq(schema.agentRun.id, id));
      await rearmSchedule(db, run);
      return NextResponse.json({ cancelled: true, status: "cancelled" });
    }

    return NextResponse.json({ cancelled: false, status: run.status });
  } catch (error) {
    console.error("[runs/:id/cancel]", error);
    return errorResponse("Could not stop the run", 500);
  }
}
