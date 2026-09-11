import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireApiUser } from "@/lib/api";
import {
  connectTool,
  disconnectTool,
  getIntegrationsOverview,
  integrationMode,
} from "@/agent/integrations";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  try {
    return NextResponse.json(await getIntegrationsOverview(user.email));
  } catch (error) {
    console.error("[integrations GET]", error);
    return errorResponse("Internal server error", 500);
  }
}

const bodySchema = z.object({ slug: z.string().min(1) });

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return errorResponse("slug is required", 400);
    const result = await connectTool(user.email, parsed.data.slug);
    return NextResponse.json({ ...result, mode: integrationMode() });
  } catch (error) {
    console.error("[integrations POST]", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unable to connect",
      500,
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return errorResponse("slug is required", 400);
    const result = await disconnectTool(user.email, parsed.data.slug);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[integrations DELETE]", error);
    return errorResponse("Unable to disconnect", 500);
  }
}
