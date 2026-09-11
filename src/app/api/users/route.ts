import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { errorResponse, requireApiUser } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return errorResponse("Unauthorized user", 401);
  return NextResponse.json({ user });
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  timezone: z.string().max(64).optional(),
  imageUrl: z.string().max(512).optional(),
});

export async function PATCH(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  try {
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "Invalid payload", 400);
    }
    const db = await getDb();
    const updated = await db
      .update(schema.users)
      .set(parsed.data)
      .where(eq(schema.users.id, user.id))
      .returning();
    const row = updated[0];
    return NextResponse.json({
      user: {
        id: row.id,
        name: row.name,
        email: row.email,
        timezone: row.timezone,
        imageUrl: row.imageUrl,
        agentCredits: row.agentCredits,
        usageCredits: row.usageCredits,
        plan: row.plan,
      },
    });
  } catch (error) {
    console.error("[users PATCH]", error);
    return errorResponse("Internal server error", 500);
  }
}
