import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { errorResponse, requireApiUser } from "@/lib/api";
import { invalidateSwr } from "@/lib/swr-cache";
import { deleteOwnedAgent, getOwnedAgent, updateOwnedAgent } from "@/agent/agents";
import { listConnections } from "@/agent/integrations";
import { toolBySlug } from "@/agent/tools/catalog";

export const runtime = "nodejs";

type Context = { params: Promise<{ agentId: string }> };

export async function GET(_request: Request, context: Context) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { agentId } = await context.params;

  try {
    const agent = await getOwnedAgent(user.email, agentId);
    if (!agent) return errorResponse("Agent not found", 404);
    const db = await getDb();
    const runs = await db
      .select()
      .from(schema.agentRun)
      .where(eq(schema.agentRun.agentId, agentId))
      .orderBy(desc(schema.agentRun.createdAt))
      .limit(20);
    const slugs = (agent.tools ?? []).filter((slug) => toolBySlug.has(slug));
    const connections = await listConnections(user.email, slugs);
    return NextResponse.json({ agent, runs, connections });
  } catch (error) {
    console.error("[agents/:id GET]", error);
    return errorResponse("Internal server error", 500);
  }
}

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  agentImage: z.string().optional(),
  description: z.string().optional(),
  objective: z.string().optional(),
  instructions: z.string().optional(),
  tools: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  outputFormat: z.string().optional(),
  status: z.enum(["active", "paused"]).optional(),
  schedule: z
    .object({
      type: z.enum(["manual", "once", "recurring"]),
      time: z.string(),
      frequency: z.enum(["hourly", "daily", "weekly", "monthly"]).nullable().optional(),
      dayOfWeek: z.number().nullable().optional(),
      dayOfMonth: z.number().nullable().optional(),
      date: z.string().nullable().optional(),
      timeZone: z.string().nullable().optional(),
    })
    .optional(),
});

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { agentId } = await context.params;

  try {
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "Invalid payload", 400);
    }
    const result = await updateOwnedAgent(user.email, agentId, parsed.data);
    if (result.error) return errorResponse(result.error, 404);
    invalidateSwr("agent-list:");
    invalidateSwr("dashboard:");
    invalidateSwr("runs:");
    return NextResponse.json({ agent: result.agent });
  } catch (error) {
    console.error("[agents/:id PATCH]", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { agentId } = await context.params;

  try {
    const result = await deleteOwnedAgent(user.email, agentId);
    if (result.error) return errorResponse(result.error, 404);
    invalidateSwr("agent-list:");
    invalidateSwr("dashboard:");
    invalidateSwr("runs:");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[agents/:id DELETE]", error);
    return errorResponse("Internal server error", 500);
  }
}
