import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { errorResponse, requireApiUser } from "@/lib/api";
import { listConnections } from "@/agent/integrations";
import { toolBySlug } from "@/agent/tools/catalog";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  try {
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId");
    const db = await getDb();

    let slugs: string[] | undefined;
    if (agentId) {
      const rows = await db
        .select({ tools: schema.agentConfig.tools })
        .from(schema.agentConfig)
        .where(
          and(
            eq(schema.agentConfig.agentId, agentId),
            eq(schema.agentConfig.userEmail, user.email),
          ),
        )
        .limit(1);
      if (!rows[0]) return errorResponse("Agent not found", 404);
      slugs = (rows[0].tools ?? []).filter((slug) => toolBySlug.has(slug));
    }

    const connections = await listConnections(user.email, slugs);
    const tools = connections.map((connection) => {
      const catalog = toolBySlug.get(connection.slug)!;
      return {
        ...connection,
        category: catalog.category,
        requiresAuth: catalog.requiresAuth,
        provider: catalog.provider,
        actions: catalog.actions,
      };
    });

    return NextResponse.json({ tools });
  } catch (error) {
    console.error("[agent/tools GET]", error);
    return errorResponse("Internal server error", 500);
  }
}
