import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { createSessionCookie, verifyPassword } from "@/lib/auth";

const schemaBody = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
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
    const { email, password } = parsed.data;
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    const user = rows[0];
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

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
    console.error("[auth/sign-in]", error);
    return NextResponse.json({ error: "Unable to sign in" }, { status: 500 });
  }
}
