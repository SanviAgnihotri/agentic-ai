import { NextResponse } from "next/server";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { errorResponse, requireApiUser } from "@/lib/api";
import { withSwr } from "@/lib/swr-cache";

export const runtime = "nodejs";

const ACTIVE_STATUSES = ["running", "queued", "scheduled"];

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  try {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const agentId = url.searchParams.get("agentId");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

    const db = await getDb();
    const conditions = [eq(schema.agentRun.userEmail, user.email)];
    if (statusParam) {
      const statuses = statusParam.split(",").map((value) => value.trim()).filter(Boolean);
      if (statuses.length === 1) {
        conditions.push(eq(schema.agentRun.status, statuses[0]));
      } else if (statuses.length > 1) {
        conditions.push(inArray(schema.agentRun.status, statuses));
      }
    }
    if (agentId) conditions.push(eq(schema.agentRun.agentId, agentId));

    // Lists never render step payloads (up to ~14KB per run) — the detail
    // endpoint includes them, the list doesn't need them.
    const listQuery = db
      .select({
        id: schema.agentRun.id,
        agentId: schema.agentRun.agentId,
        status: schema.agentRun.status,
        trigger: schema.agentRun.trigger,
        scheduleFor: schema.agentRun.scheduleFor,
        timeZone: schema.agentRun.timeZone,
        queuedAt: schema.agentRun.queuedAt,
        startedAt: schema.agentRun.startedAt,
        completedAt: schema.agentRun.completedAt,
        createdAt: schema.agentRun.createdAt,
        output: schema.agentRun.output,
        error: schema.agentRun.error,
        agentName: schema.agentConfig.name,
        agentImage: schema.agentConfig.agentImage,
        agentStatus: schema.agentConfig.status,
      })
      .from(schema.agentRun)
      .leftJoin(
        schema.agentConfig,
        eq(schema.agentRun.agentId, schema.agentConfig.agentId),
      )
      .where(and(...conditions))
      .orderBy(desc(schema.agentRun.createdAt))
      .limit(limit)
      .offset(offset);

    const countsQuery = db
      .select({ status: schema.agentRun.status, count: count() })
      .from(schema.agentRun)
      .where(eq(schema.agentRun.userEmail, user.email))
      .groupBy(schema.agentRun.status);

    const payload = await withSwr(
      `runs:${user.email}:${statusParam ?? "all"}:${agentId ?? "all"}:${limit}:${offset}`,
      async () => {
        const [rows, grouped] = await Promise.all([listQuery, countsQuery]);

        const runs = rows.map((row) => ({
          ...row,
          agentName: row.agentName,
          agentImage: row.agentImage,
          agentStatus: row.agentStatus,
        }));

        const stats = grouped.reduce<Record<string, number>>((acc, row) => {
          acc[row.status] = Number(row.count);
          return acc;
        }, {});

        return {
          runs,
          stats,
          active: runs.filter((run) => ACTIVE_STATUSES.includes(run.status)).length,
        };
      },
      2_500,
    );

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[runs GET]", error);
    return errorResponse("Internal server error", 500);
  }
}
