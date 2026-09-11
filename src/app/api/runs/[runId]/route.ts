import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { errorResponse, requireApiUser } from "@/lib/api";

export const runtime = "nodejs";

type Context = { params: Promise<{ runId: string }> };

export async function GET(_request: Request, context: Context) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { runId } = await context.params;

  try {
    const id = Number(runId);
    if (!Number.isFinite(id)) return errorResponse("Invalid run id", 400);
    const db = await getDb();
    const rows = await db
      .select({
        run: schema.agentRun,
        agent: schema.agentConfig,
      })
      .from(schema.agentRun)
      .leftJoin(schema.agentConfig, eq(schema.agentRun.agentId, schema.agentConfig.agentId))
      .where(and(eq(schema.agentRun.id, id), eq(schema.agentRun.userEmail, user.email)))
      .limit(1);
    if (!rows[0]) return errorResponse("Run not found", 404);
    return NextResponse.json({ run: rows[0].run, agent: rows[0].agent });
  } catch (error) {
    console.error("[runs/:id GET]", error);
    return errorResponse("Internal server error", 500);
  }
}
