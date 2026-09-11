import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb, schema } from "@/db";

/**
 * Better Auth — the app's only auth system.
 *
 * Session/identity tables are the Better Auth defaults (`user`, `session`,
 * `account`, `verification`); the app-specific profile (plan, credits, Dodo
 * ids) stays in the existing `users` table, keyed by email — see
 * `upsertAppUser` in `@/lib/auth`. The demo workspace signs in through Better
 * Auth as well (seeded credentials), so there is a single cookie family.
 *
 * The instance is memoised on globalThis so dev HMR doesn't rebuild it and
 * `getDb()` migrations only run once.
 */
const createAuth = async () =>
  betterAuth({
    baseURL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [baseURL],
    database: drizzleAdapter(await getDb(), {
      provider: "pg",
      schema: {
        user: schema.betterAuthUser,
        session: schema.betterAuthSession,
        account: schema.betterAuthAccount,
        verification: schema.betterAuthVerification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      // The deployed app is closed for registration: existing accounts can
      // sign in, but the public sign-up endpoint is disabled. New identities
      // are additionally gated by the allowlist hook below.
      disableSignUp: true,
    },
    databaseHooks: {
      user: {
        create: {
          // Block identity creation (e.g. a first-time social sign-in) unless
          // the email is allowlisted via AUTH_SIGNUP_ALLOWLIST (comma-separated).
          before: async (user) => {
            const allowlist = (process.env.AUTH_SIGNUP_ALLOWLIST ?? "")
              .split(",")
              .map((email) => email.trim().toLowerCase())
              .filter(Boolean);
            if (allowlist.length > 0 && !allowlist.includes(user.email.toLowerCase())) {
              throw new APIError("FORBIDDEN", {
                message: "Sign-ups are disabled",
              });
            }
          },
        },
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 30 }, // 30 days, like the old demo session
    socialProviders: {
      ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {}),
      ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
        ? {
            github: {
              clientId: process.env.GITHUB_CLIENT_ID,
              clientSecret: process.env.GITHUB_CLIENT_SECRET,
            },
          }
        : {}),
    },
    advanced: {
      // The app's only cookie family (`better-auth.*`).
      cookiePrefix: "better-auth",
    },
  });

export type BetterAuthInstance = Awaited<ReturnType<typeof createAuth>>;

type AuthGlobal = { ready?: Promise<BetterAuthInstance> };
const globalForAuth = globalThis as unknown as { __groovyAuth?: AuthGlobal };
const state: AuthGlobal = (globalForAuth.__groovyAuth ??= {});

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export function getBetterAuth(): Promise<BetterAuthInstance> {
  state.ready ??= createAuth();
  return state.ready;
}
