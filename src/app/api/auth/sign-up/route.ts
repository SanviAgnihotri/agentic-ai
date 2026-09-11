import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { createSessionCookie, hashPassword } from "@/lib/auth";
import { ensureToolsSeeded } from "@/db/seed";

const schemaBody = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export async function POST(request: Request) {
  try {
    const parsed = schemaBody.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    const { name, email, password } = parsed.data;
    const db = await getDb();
    const existing = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in instead." },
        { status: 409 },
      );
    }

    const inserted = await db
      .insert(schema.users)
      .values({
        name,
        email,
        passwordHash: hashPassword(password),
        timezone: "UTC",
        agentCredits: 3,
        usageCredits: 200,
      })
      .returning();

    const user = inserted[0];
    await ensureToolsSeeded();
    await createSessionCookie(user.id);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        agentCredits: user.agentCredits,
        usageCredits: user.usageCredits,
      },
    });
  } catch (error) {
    console.error("[auth/sign-up]", error);
    return NextResponse.json({ error: "Unable to create account" }, { status: 500 });
  }
}
