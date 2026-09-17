import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb, schema } from "@/db";

/**
 * Better Auth — the app's only auth system.
 *
 * Session/identity tables are the Better Auth defaults (`user`, `session`,
 * `account`, `verification`); the app-specific profile (plan, credits, Dodo
 * ids) stays in the existing `users` table, keyed by email — see
 * `upsertAppUser` in `@/lib/auth`. So there is a single cookie family.
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
      // Registration is open. To gate it again, set AUTH_SIGNUP_ALLOWLIST
      // (comma-separated emails) — the hook below then blocks any other
      // identity creation, and `disableSignUp: true` closes email+password
      // sign-up as well.
    },
    databaseHooks: {
      user: {
        create: {
          // Optional gate: when AUTH_SIGNUP_ALLOWLIST (comma-separated) is
          // set, identity creation (sign-up or a first-time social sign-in)
          // is restricted to those emails. Empty/unset means open registration.
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
    // Account linking — one `user` row per email, one `account` row per provider.
    //
    // Google and GitHub both return provider-verified emails, so a second
    // social sign-in with the same email (e.g. Google first, then GitHub)
    // automatically links the new provider to the existing user instead of
    // failing or creating a duplicate identity. Linking is only ever allowed
    // between accounts that share the exact same email (`allowDifferentEmails`
    // stays false). Password-first users — whose local `emailVerified` is
    // false because no verification email is sent — cannot be linked
    // implicitly; they link from Settings → Connected accounts while signed
    // in, which proves ownership of both identities.
    account: {
      accountLinking: {
        enabled: true,
        allowDifferentEmails: false,
      },
    },
    // OAuth failures (e.g. "account not linked") redirect here with
    // ?error=<code>&error_description=<text> instead of Better Auth's default
    // /error 404.
    onAPIError: {
      errorURL: "/auth-error",
    },
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
