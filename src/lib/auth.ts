import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { userImage } from "./avatar";
import { dodoEnabled } from "@/lib/dodo";

export const SESSION_COOKIE = "groovy_session";
const SESSION_TTL_DAYS = 30;

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

/** scrypt password hashing — no native dependencies. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export async function createSessionCookie(userId: number): Promise<void> {
  const db = await getDb();
  const token = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(schema.sessions).values({ token, userId, expiresAt });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySessionCookie(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.token, token));
  }
  store.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    if (clerkEnabled()) {
      const { currentUser } = await import("@clerk/nextjs/server");
      const clerkUser = await currentUser();
      if (clerkUser) {
        const email =
          clerkUser.primaryEmailAddress?.emailAddress ??
          clerkUser.emailAddresses[0]?.emailAddress;
        if (email) {
          return upsertClerkUser({
            email,
            name: clerkUser.fullName,
            imageUrl: clerkUser.imageUrl,
          });
        }
      }
      // No Clerk session — fall through to the built-in cookie session
      // (covers the demo login and any pre-Clerk users).
    }

    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const db = await getDb();
    const rows = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        imageUrl: schema.users.imageUrl,
        timezone: schema.users.timezone,
        plan: schema.users.plan,
        agentCredits: schema.users.agentCredits,
        usageCredits: schema.users.usageCredits,
        createdAt: schema.users.createdAt,
      })
      .from(schema.sessions)
      .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
      .where(
        and(
          eq(schema.sessions.token, token),
          gt(schema.sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** Clerk is active only when both keys are configured. */
export function clerkEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
  );
}

/** Map a Clerk identity onto our users table (create or refresh profile). */
async function upsertClerkUser(input: {
  email: string;
  name: string | null;
  imageUrl: string | null;
}): Promise<SessionUser> {
  const db = await getDb();
  const displayName = input.name?.trim() || input.email.split("@")[0];

  // Mirror the Clerk Billing entitlement so background schedulers (no request
  // context) can gate live runs — but ONLY when Clerk Billing is the payment
  // provider. With Dodo Payments enabled, the Dodo webhook owns `users.plan`
  // and this session refresh must never clobber it.
  let plan: string | undefined;
  if (!dodoEnabled()) {
    const { auth } = await import("@clerk/nextjs/server");
    const { has } = await auth();
    plan = has?.({ plan: "pro" }) ? "pro" : "free";
  }

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, input.email))
    .limit(1);

  if (existing[0]) {
    const updates: Partial<typeof schema.users.$inferInsert> = {};
    if (input.name && input.name !== existing[0].name) updates.name = input.name;
    if (input.imageUrl && input.imageUrl !== existing[0].imageUrl) {
      updates.imageUrl = input.imageUrl;
    }
    if (plan && plan !== existing[0].plan) updates.plan = plan;
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
      ...(plan ? { plan } : {}),
    })
    .onConflictDoNothing()
    .returning();

  if (inserted[0]) return inserted[0];

  const retry = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, input.email))
    .limit(1);
  if (!retry[0]) throw new Error("Could not create user record for Clerk identity");
  return retry[0];
}

export { avatarUrl, userImage } from "./avatar";
