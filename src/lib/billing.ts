import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { dodoEnabled } from "@/lib/dodo";
import { PRO_PLAN_SLUG } from "@/lib/plans";

export { PRO_PLAN_SLUG };
export const UPGRADE_MESSAGE =
  "Live agent runs require the Pro plan. Upgrade from the Billing page to keep your agents running.";

/** Subscription statuses that should not grant access. */
const INACTIVE_STATUSES = new Set(["cancelled", "expired", "failed"]);

/**
 * Does this user have access to live execution?
 *
 * - Dodo Payments configured: the `users` row is the entitlement source of
 *   truth, kept in sync by the Dodo webhook handler (`plan` + status).
 * - Not configured (local dev / demo): everything is allowed so the platform
 *   stays zero-config.
 */
export async function hasActivePlan(userEmail: string): Promise<boolean> {
  if (dodoEnabled()) {
    const db = await getDb();
    const rows = await db
      .select({ plan: schema.users.plan, status: schema.users.subscriptionStatus })
      .from(schema.users)
      .where(eq(schema.users.email, userEmail))
      .limit(1);
    const row = rows[0];
    if (!row) return false;
    return row.plan === PRO_PLAN_SLUG && !(row.status && INACTIVE_STATUSES.has(row.status));
  }

  return true;
}

/** Used by background schedulers (no request context): mirrors users.plan. */
export function planAllowsLiveRuns(
  plan: string | null | undefined,
  status?: string | null,
): boolean {
  if (dodoEnabled()) {
    return plan === PRO_PLAN_SLUG && !(status && INACTIVE_STATUSES.has(status));
  }
  return true;
}
