import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { userImage } from "./avatar";
import { getBetterAuth } from "./better-auth";

export type SessionUser = {
  id: number;
  name: string | null;
  email: string;
  imageUrl: string | null;
  timezone: string | null;
  plan: string | null;
  agentCredits: number | null;
  usageCredits: number | null;
  createdAt: Date;
};

/**
 * Resolve the signed-in user.
 *
 * Better Auth owns the session (Google / GitHub / email+password); the session
 * user is mapped onto the app's `users` table by email, creating the row on
 * first sign-in. The demo workspace signs in through Better Auth too
 * (`/api/demo` seeds its identity with known credentials).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    return await betterAuthSessionUser();
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** Resolve the Better Auth session and map it onto our `users` table. */
async function betterAuthSessionUser(): Promise<SessionUser | null> {
  const auth = await getBetterAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  const baUser = session?.user;
  if (!baUser?.email) return null;

  return upsertAppUser({
    email: baUser.email.toLowerCase(),
    name: baUser.name ?? null,
    imageUrl: baUser.image ?? null,
  });
}

/**
 * Map a Better Auth identity onto our users table (create or refresh profile).
 *
 * `users.plan` is owned by the Dodo Payments webhook — this never touches it.
 * Background schedulers gate on the mirrored plan, so the row must exist by
 * the time an agent is created (it does: agent APIs require a session).
 */
export async function upsertAppUser(input: {
  email: string;
  name: string | null;
  imageUrl: string | null;
}): Promise<SessionUser> {
  const db = await getDb();
  const displayName = input.name?.trim() || input.email.split("@")[0];

  const selection = {
    id: schema.users.id,
    name: schema.users.name,
    email: schema.users.email,
    imageUrl: schema.users.imageUrl,
    timezone: schema.users.timezone,
    plan: schema.users.plan,
    agentCredits: schema.users.agentCredits,
    usageCredits: schema.users.usageCredits,
    createdAt: schema.users.createdAt,
  };

  const existing = await db
    .select(selection)
    .from(schema.users)
    .where(eq(schema.users.email, input.email))
    .limit(1);

  if (existing[0]) {
    const updates: Partial<typeof schema.users.$inferInsert> = {};
    if (input.name && input.name !== existing[0].name) updates.name = input.name;
    if (input.imageUrl && input.imageUrl !== existing[0].imageUrl) {
      updates.imageUrl = input.imageUrl;
    }
    if (Object.keys(updates).length > 0) {
      await db.update(schema.users).set(updates).where(eq(schema.users.email, input.email));
    }
    return { ...existing[0], ...updates };
  }

  const inserted = await db
    .insert(schema.users)
    .values({
      email: input.email,
      name: displayName,
      imageUrl: input.imageUrl ?? userImage(displayName),
    })
    .onConflictDoNothing()
    .returning(selection);

  if (inserted[0]) return inserted[0];

  const retry = await db
    .select(selection)
    .from(schema.users)
    .where(eq(schema.users.email, input.email))
    .limit(1);
  if (!retry[0]) throw new Error("Could not create user record for auth identity");
  return retry[0];
}

export { avatarUrl, userImage } from "./avatar";
