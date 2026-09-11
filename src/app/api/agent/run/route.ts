import { NextResponse } from "next/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { errorResponse, requireApiUser } from "@/lib/api";
import { invalidateSwr } from "@/lib/swr-cache";
import { executeAgent, type RunnerAgent } from "@/agent/engine/runner";
import { enqueueRun } from "@/agent/engine/scheduler";
import { hasActivePlan, UPGRADE_MESSAGE } from "@/lib/billing";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  agentId: z.string().min(1),
  input: z.string().optional().default(""),
  mode: z.enum(["chat", "run"]).optional().default("chat"),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return errorResponse("agentId is required", 400);

    const db = await getDb();
    const agentRows = await db
      .select()
      .from(schema.agentConfig)
      .where(
        and(
          eq(schema.agentConfig.agentId, parsed.data.agentId),
          eq(schema.agentConfig.userEmail, user.email),
        ),
      )
      .limit(1);
    const agent = agentRows[0];
    if (!agent) return errorResponse("Agent not found", 404);

    // Billing gate: live execution (run + chat, which both spend credits)
    // requires an active subscription when Dodo Payments billing is enabled.
    if (!(await hasActivePlan(user.email))) {
      return errorResponse(UPGRADE_MESSAGE, 402);
    }

    const input = parsed.data.input?.trim() || agent.objective || "Complete the configured task";

    if (parsed.data.mode === "run") {
      const runId = await enqueueRun({
        agentId: agent.agentId,
        userEmail: user.email,
        trigger: "manual",
      });
      invalidateSwr("agent-list:");
      invalidateSwr("dashboard:");
      invalidateSwr("runs:");
      return NextResponse.json({ runId, mode: "run" });
    }

    // Chat mode: execute synchronously and persist the conversation.
    const historyRows = await db
      .select({
        role: schema.agentMessages.role,
        content: schema.agentMessages.content,
      })
      .from(schema.agentMessages)
      .where(eq(schema.agentMessages.agentId, agent.agentId))
      .orderBy(desc(schema.agentMessages.id))
      .limit(12);
    const history = historyRows
      .reverse()
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content,
      }));

    const inserted = await db
      .insert(schema.agentRun)
      .values({
        agentId: agent.agentId,
        userEmail: user.email,
        scheduleFor: new Date(),
        timeZone: "UTC",
        status: "running",
        trigger: "chat",
        startedAt: new Date(),
      })
      .returning({ id: schema.agentRun.id });
    const runId = inserted[0].id;

    const recentRuns = await db
      .select({
        id: schema.agentRun.id,
        status: schema.agentRun.status,
        output: schema.agentRun.output,
        createdAt: schema.agentRun.createdAt,
      })
      .from(schema.agentRun)
      .where(
        and(
          eq(schema.agentRun.agentId, agent.agentId),
          inArray(schema.agentRun.status, ["completed", "failed"]),
        ),
      )
      .orderBy(desc(schema.agentRun.createdAt))
      .limit(3);

    const result = await executeAgent({
      userEmail: user.email,
      agent: agent as unknown as RunnerAgent,
      input,
      mode: "chat",
      maxSteps: 4,
      history,
      runs: recentRuns.map((run) => ({
        ...run,
        createdAt: run.createdAt.toISOString(),
      })),
      onSteps: async (steps) => {
        const inner = await getDb();
        await inner
          .update(schema.agentRun)
          .set({ steps })
          .where(eq(schema.agentRun.id, runId));
      },
    });

    const reply =
      result.output ||
      "I could not complete that request. Check the run log for details.";

    await db
      .update(schema.agentRun)
      .set({
        status: result.status,
        output: reply,
        steps: result.steps,
        error: result.error ?? null,
        completedAt: new Date(),
      })
      .where(eq(schema.agentRun.id, runId));

    await db.insert(schema.agentMessages).values([
      { agentId: agent.agentId, userEmail: user.email, runId, role: "user", content: input },
      {
        agentId: agent.agentId,
        userEmail: user.email,
        runId,
        role: "assistant",
        content: reply,
        metadata: { creditsUsed: result.creditsUsed, liveUrl: result.liveUrl ?? null },
      },
    ]);

    if (result.creditsUsed > 0) {
      await db
        .update(schema.users)
        .set({
          usageCredits: sql`GREATEST(COALESCE(${schema.users.usageCredits}, 0) - ${result.creditsUsed}, 0)`,
        })
        .where(eq(schema.users.id, user.id));
    }

    return NextResponse.json({
      reply,
      runId,
      steps: result.steps,
      status: result.status,
      liveUrl: result.liveUrl ?? null,
    });
  } catch (error) {
    console.error("[agent/run POST]", error);
    return errorResponse("Agent execution failed", 500);
  }
}

/** Conversation history for the chat drawer. */
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  try {
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId");
    if (!agentId) return errorResponse("agentId is required", 400);
    const db = await getDb();
    const owned = await db
      .select({ id: schema.agentConfig.id })
      .from(schema.agentConfig)
      .where(
        and(
          eq(schema.agentConfig.agentId, agentId),
          eq(schema.agentConfig.userEmail, user.email),
        ),
      )
      .limit(1);
    if (!owned[0]) return errorResponse("Agent not found", 404);

    const messages = await db
      .select({
        id: schema.agentMessages.id,
        role: schema.agentMessages.role,
        content: schema.agentMessages.content,
        createdAt: schema.agentMessages.createdAt,
      })
      .from(schema.agentMessages)
      .where(eq(schema.agentMessages.agentId, agentId))
      .orderBy(asc(schema.agentMessages.id))
      .limit(100);

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("[agent/run GET]", error);
    return errorResponse("Internal server error", 500);
  }
}
