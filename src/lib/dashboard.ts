/**
 * Fast dashboard snapshot — DB queries only, no AI work. Used by the dashboard
 * page (server-rendered so the shell paints instantly) and by the polling API.
 * The AI briefing lives in its own slow endpoint (/api/dashboard/briefing).
 */
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";

export interface DashboardStats {
  agents: number;
  activeAgents: number;
  pausedAgents: number;
  completed: number;
  failed: number;
  running: number;
  queued: number;
  scheduled: number;
}

export interface DashboardRun {
  id: number;
  agentId: string;
  agentName: string;
  agentImage: string | null;
  status: string;
  scheduleFor: string;
  createdAt: string;
  output: string | null;
  error: string | null;
  excerpt?: string | null;
}

export interface DashboardSnapshot {
  stats: DashboardStats;
  upcoming: DashboardRun[];
  latest: DashboardRun[];
  activity: Array<{ day: string; completed: number; failed: number }>;
}

export async function getDashboardSnapshot(
  userEmail: string,
): Promise<DashboardSnapshot> {
  const db = await getDb();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Independent queries — parallelized so one round-trip, not three. Runs list
  // never carries the step payloads (up to ~14KB each).
  const [agents, runs, recent] = await Promise.all([
    db
      .select()
      .from(schema.agentConfig)
      .where(eq(schema.agentConfig.userEmail, userEmail)),
    db
      .select({
        id: schema.agentRun.id,
        agentId: schema.agentRun.agentId,
        status: schema.agentRun.status,
        scheduleFor: schema.agentRun.scheduleFor,
        createdAt: schema.agentRun.createdAt,
        output: schema.agentRun.output,
        error: schema.agentRun.error,
      })
      .from(schema.agentRun)
      .where(eq(schema.agentRun.userEmail, userEmail))
      .orderBy(desc(schema.agentRun.createdAt))
      .limit(60),
    db
      .select({
        id: schema.agentRun.id,
        createdAt: schema.agentRun.createdAt,
        status: schema.agentRun.status,
      })
      .from(schema.agentRun)
      .where(
        and(
          eq(schema.agentRun.userEmail, userEmail),
          gte(schema.agentRun.createdAt, sevenDaysAgo),
          lte(schema.agentRun.createdAt, now),
        ),
      ),
  ]);

  const stats: DashboardStats = {
    agents: agents.length,
    activeAgents: agents.filter((agent) => agent.status === "active").length,
    pausedAgents: agents.filter((agent) => agent.status === "paused").length,
    completed: runs.filter((run) => run.status === "completed").length,
    failed: runs.filter((run) => run.status === "failed").length,
    running: runs.filter((run) => run.status === "running").length,
    queued: runs.filter((run) => run.status === "queued").length,
    scheduled: runs.filter((run) => run.status === "scheduled").length,
  };

  const agentById = new Map(agents.map((agent) => [agent.agentId, agent]));

  const toRun = (
    run: (typeof runs)[number],
    excerpt?: string | null,
  ): DashboardRun => ({
    id: run.id,
    agentId: run.agentId,
    agentName: agentById.get(run.agentId)?.name ?? "Agent",
    agentImage: agentById.get(run.agentId)?.agentImage ?? null,
    status: run.status,
    scheduleFor: run.scheduleFor.toISOString(),
    createdAt: run.createdAt.toISOString(),
    output: run.output,
    error: run.error,
    excerpt: excerpt ?? null,
  });

  const upcoming = runs
    .filter((run) => run.status === "scheduled")
    .sort(
      (a, b) => new Date(a.scheduleFor).getTime() - new Date(b.scheduleFor).getTime(),
    )
    .slice(0, 6)
    .map((run) => toRun(run));

  const latest = runs
    .filter((run) => run.status === "completed" || run.status === "failed")
    .slice(0, 6)
    .map((run) =>
      toRun(
        run,
        run.output
          ? run.output
              .replace(/[#>*_`-]/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 180)
          : null,
      ),
    );

  // Runs per day for the activity chart (last 7 days).
  const activity: Array<{ day: string; completed: number; failed: number }> = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = day.toISOString().slice(0, 10);
    activity.push({
      day: key,
      completed: recent.filter(
        (run) =>
          run.createdAt.toISOString().slice(0, 10) === key && run.status === "completed",
      ).length,
      failed: recent.filter(
        (run) =>
          run.createdAt.toISOString().slice(0, 10) === key && run.status === "failed",
      ).length,
    });
  }

  return { stats, upcoming, latest, activity };
}
