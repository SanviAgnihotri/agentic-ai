import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireApiUser } from "@/lib/api";
import { connectTool, disconnectTool, integrationMode } from "@/agent/integrations";

export const runtime = "nodejs";

const bodySchema = z.object({
  toolSlug: z.string().min(1),
  agentId: z.string().optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return errorResponse("toolSlug is required", 400);
    const result = await connectTool(user.email, parsed.data.toolSlug);
    return NextResponse.json({
      ...result,
      mode: integrationMode(),
    });
  } catch (error) {
    console.error("[agent/tools/connect POST]", error);
    return errorResponse(error instanceof Error ? error.message : "Connection failed", 500);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return errorResponse("toolSlug is required", 400);
    const result = await disconnectTool(user.email, parsed.data.toolSlug);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[agent/tools/connect DELETE]", error);
    return errorResponse("Unable to disconnect", 500);
  }
}
