import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { createSessionCookie, hashPassword } from "@/lib/auth";
import { userImage } from "@/lib/avatar";
import { ensureToolsSeeded, seedDemoWorkspace } from "@/db/seed";

const DEMO_EMAIL = "demo@groovy.ai";
const DEMO_NAME = "Adi Verma";
const DEMO_PASSWORD = "groovy-demo-2026";

/** One-click demo workspace with sample agents, runs and connections. */
export async function POST() {
  try {
    const db = await getDb();
    await ensureToolsSeeded();

    const rows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, DEMO_EMAIL))
      .limit(1);
    let user = rows[0];

    if (!user) {
      const inserted = await db
        .insert(schema.users)
        .values({
          name: DEMO_NAME,
          email: DEMO_EMAIL,
          passwordHash: hashPassword(DEMO_PASSWORD),
          imageUrl: userImage(DEMO_NAME),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          agentCredits: 10,
          usageCredits: 2000,
          plan: "pro",
        })
        .returning();
      user = inserted[0];
    }

    await seedDemoWorkspace(DEMO_EMAIL);
    await createSessionCookie(user.id);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        agentCredits: user.agentCredits,
        usageCredits: user.usageCredits,
      },
      demo: true,
    });
  } catch (error) {
    console.error("[auth/demo]", error);
    return NextResponse.json(
      { error: "Unable to start the demo workspace" },
      { status: 500 },
    );
  }
}
