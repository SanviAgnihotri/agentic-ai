/**
 * Reconcile Pro entitlements from Dodo Payments into the app database.
 *
 * Webhooks are the primary grant path, but they can be missed (endpoint was
 * unreachable, signature key rotated, delivery outage). This script pulls
 * every subscription from Dodo and applies the same absolute state as the
 * webhook handler, so the database can always be brought back in sync.
 *
 * Idempotent: rows already matching Dodo are left untouched (and usage
 * credits are only reset on a free → pro transition, so reconciling never
 * wipes accumulated usage).
 *
 * Usage:
 *   bun --env-file=.env.local scripts/dodo-reconcile.ts [--dry-run]
 */
import DodoPayments from "dodopayments";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../src/db";
import { PRO_USAGE_CREDITS } from "../src/lib/plans";

const dryRun = process.argv.includes("--dry-run");

const apiKey = process.env.DODO_PAYMENTS_API_KEY;
if (!apiKey) {
  console.error("DODO_PAYMENTS_API_KEY is not set (use --env-file=.env.local)");
  process.exit(1);
}

const client = new DodoPayments({
  bearerToken: apiKey,
  environment:
    process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode",
});

const ACTIVE_STATUSES = new Set(["active", "trialing", "on_hold"]);

const db = await getDb();
let updated = 0;
let unchanged = 0;
let skipped = 0;

for await (const subscription of client.subscriptions.list({ page_size: 100 })) {
  const rawEmail =
    subscription.metadata?.user_email ?? subscription.customer?.email ?? "";
  const email = typeof rawEmail === "string" ? rawEmail.toLowerCase() : "";
  const label = `${subscription.subscription_id} ${email ? `<${email}>` : "(no email)"}`;

  if (!email) {
    console.log(`- ${label}: skipped — no email on subscription`);
    skipped += 1;
    continue;
  }

  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  const user = rows[0];

  if (!user) {
    console.log(`- ${label}: skipped — no app user with that email`);
    skipped += 1;
    continue;
  }

  const active = ACTIVE_STATUSES.has(subscription.status ?? "");
  const nextPlan = active ? "pro" : "free";
  const nextStatus = subscription.status ?? null;
  const nextCustomer = subscription.customer?.customer_id ?? user.dodoCustomerId;

  const isSame =
    user.plan === nextPlan &&
    user.subscriptionStatus === nextStatus &&
    user.dodoCustomerId === nextCustomer &&
    user.dodoSubscriptionId === subscription.subscription_id;

  if (isSame) {
    console.log(`- ${label}: in sync (${nextPlan}/${nextStatus})`);
    unchanged += 1;
    continue;
  }

  const resetCredits = active && user.plan !== "pro";
  console.log(
    `- ${label}: ${user.plan}/${user.subscriptionStatus ?? "—"} -> ${nextPlan}/${nextStatus ?? "—"}${resetCredits ? " (+ credits reset)" : ""}${dryRun ? " [dry-run]" : ""}`,
  );

  if (!dryRun) {
    await db
      .update(schema.users)
      .set({
        plan: nextPlan,
        subscriptionStatus: nextStatus,
        dodoCustomerId: nextCustomer,
        dodoSubscriptionId: subscription.subscription_id,
        ...(resetCredits ? { usageCredits: PRO_USAGE_CREDITS } : {}),
      })
      .where(eq(schema.users.id, user.id));
  }
  updated += 1;
}

console.log(
  `\n${dryRun ? "Would update" : "Updated"}: ${updated} · already in sync: ${unchanged} · skipped: ${skipped}`,
);
process.exit(0);
