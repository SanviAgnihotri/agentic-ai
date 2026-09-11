import { NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import type { ScheduleConfig } from "@/db/schema";
import { errorResponse, requireApiUser } from "@/lib/api";
import { invalidateSwr, withSwr } from "@/lib/swr-cache";
import { avatarUrl } from "@/lib/avatar";
import { generateAgentConfig } from "@/agent/ai";
import { updateOwnedAgent } from "@/agent/agents";
import { insertFirstRunIfScheduled } from "@/agent/engine/scheduler";
import { getIntegrationsOverview } from "@/agent/integrations";
import { ensureToolsSeeded } from "@/db/seed";
import { TOOL_CATALOG } from "@/agent/tools/catalog";

export const runtime = "nodejs";
export const maxDuration = 120;

const configureBody = z.object({
  prompt: z.string(),
  answers: z.record(z.string(), z.string()).optional().nullable(),
  timeZone: z.string().optional(),
});

/* ------------------------------------------------------------------ */
/* POST — generate an agent configuration (and save it when ready)      */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  try {
    const parsed = configureBody.safeParse(await request.json());
    if (!parsed.success) return errorResponse("Prompt is required", 400);
    const prompt = parsed.data.prompt?.trim();
    if (!prompt) return errorResponse("Prompt is required", 400);

    await ensureToolsSeeded();
    const db = await getDb();

    // Free-plan agent limit.
    const existing = await db
      .select({ id: schema.agentConfig.id })
      .from(schema.agentConfig)
      .where(eq(schema.agentConfig.userEmail, user.email));
    const limit = user.agentCredits ?? 3;
    if (existing.length >= limit) {
      return errorResponse(
        `You have reached your plan limit of ${limit} agents. Delete an agent or upgrade to create more.`,
        403,
      );
    }

    const toolRows = await db.select({ slug: schema.tools.slug }).from(schema.tools);
    const toolSlugs = toolRows.length
      ? toolRows.map((row) => row.slug)
      : TOOL_CATALOG.map((tool) => tool.slug);

    const overview = await getIntegrationsOverview(user.email);
    const connectedTools = overview.tools
      .filter((tool) => tool.connected && tool.requiresAuth)
      .map((tool) => ({ slug: tool.slug, name: tool.name }));

    const response = await generateAgentConfig({
      prompt,
      answers: parsed.data.answers ?? null,
      toolSlugs,
      connectedTools,
      timeZone: parsed.data.timeZone,
    });

    if (response.status === "needs_clarification") {
      return NextResponse.json({
        status: "needs_clarification",
        clarificationQuestions: response.clarificationQuestions ?? [],
      });
    }

    const config = response.config!;
    const id = crypto.randomUUID();
    const timeZone =
      parsed.data.timeZone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC";
    const schedule: ScheduleConfig = {
      ...config.schedule,
      timeZone,
    };

    const inserted = await db
      .insert(schema.agentConfig)
      .values({
        userEmail: user.email,
        agentId: id,
        name: config.name,
        agentImage: avatarUrl(id, config.name),
        description: config.description,
        objective: config.objective,
        instructions: config.instructions,
        tools: config.tools,
        skills: config.skills,
        schedule,
        outputFormat: config.outputFormat,
        status: "active",
        composioSessionId: "",
      })
      .returning();

    await insertFirstRunIfScheduled({
      agentId: id,
      userEmail: user.email,
      schedule,
      timeZone,
    });

    invalidateSwr("agent-list:");
    invalidateSwr("dashboard:");
    invalidateSwr("runs:");

    return NextResponse.json({
      status: "ready",
      agent: inserted[0],
      config,
    });
  } catch (error) {
    console.error("[agent/configure POST]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const isProviderError = /groq|openai|gemini|model|api key|rate limit/i.test(message);
    return errorResponse(
      isProviderError
        ? `AI provider error: ${message}`
        : "Internal server error",
      isProviderError ? 502 : 500,
    );
  }
}

/* ------------------------------------------------------------------ */
/* GET — list the current user's agents with next/last run metadata     */
/* ------------------------------------------------------------------ */

export async function GET() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  try {
    const payload = await withSwr(
      `agent-list:${user.email}`,
      async () => {
        const db = await getDb();
        // Two independent queries — run in parallel to pay one round-trip, not two.
        const [agents, runs] = await Promise.all([
          db
            .select()
            .from(schema.agentConfig)
            .where(eq(schema.agentConfig.userEmail, user.email))
            .orderBy(desc(schema.agentConfig.createdAt)),
          db
            .select({
              id: schema.agentRun.id,
              agentId: schema.agentRun.agentId,
              status: schema.agentRun.status,
              scheduleFor: schema.agentRun.scheduleFor,
              completedAt: schema.agentRun.completedAt,
              createdAt: schema.agentRun.createdAt,
              output: schema.agentRun.output,
              error: schema.agentRun.error,
            })
            .from(schema.agentRun)
            .where(eq(schema.agentRun.userEmail, user.email))
            .orderBy(desc(schema.agentRun.createdAt)),
        ]);

        const enriched = agents.map((agent) => {
          const agentRuns = runs.filter((run) => run.agentId === agent.agentId);
          const nextRun = agentRuns
            .filter((run) => run.status === "scheduled")
            .sort(
              (a, b) =>
                new Date(a.scheduleFor).getTime() - new Date(b.scheduleFor).getTime(),
            )[0];
          const lastRun = agentRuns.find((run) => run.status !== "scheduled");
          return {
            ...agent,
            nextRun: nextRun ?? null,
            lastRun: lastRun ?? null,
            runCount: agentRuns.filter((run) => run.status !== "scheduled").length,
          };
        });

        return { agents: enriched };
      },
      4_000,
    );

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[agent/configure GET]", error);
    return errorResponse("Internal server error", 500);
  }
}

/* ------------------------------------------------------------------ */
/* PUT — update an agent configuration from the edit sheet              */
/* ------------------------------------------------------------------ */

const updateBody = z.object({
  agentId: z.string(),
  name: z.string().optional(),
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
      frequency: z
        .enum(["hourly", "daily", "weekly", "monthly"])
        .nullable()
        .optional(),
      dayOfWeek: z.number().nullable().optional(),
      dayOfMonth: z.number().nullable().optional(),
      date: z.string().nullable().optional(),
      timeZone: z.string().nullable().optional(),
    })
    .optional(),
});

export async function PUT(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  try {
    const parsed = updateBody.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "Invalid payload", 400);
    }
    const { agentId, ...changes } = parsed.data;
    const result = await updateOwnedAgent(user.email, agentId, changes);
    if (result.error) return errorResponse(result.error, 404);
    return NextResponse.json({ agent: result.agent });
  } catch (error) {
    console.error("[agent/configure PUT]", error);
    return errorResponse("Internal server error", 500);
  }
}
