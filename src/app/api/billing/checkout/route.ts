import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { errorResponse, requireApiUser } from "@/lib/api";
import { appUrl, dodoEnabled, getDodo } from "@/lib/dodo";
import { productIdForPlan } from "@/lib/plan-products.server";
import { PRO_TRIAL_DAYS } from "@/lib/plans";

/**
 * Start a Dodo Payments checkout session for the Pro plan.
 *
 * The browser sends a public plan slug (`pro_monthly` / `pro_yearly`); the
 * server maps it to an allowlisted Dodo product id. Access is never granted
 * from the return URL — only the verified webhook does that.
 */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  if (!dodoEnabled()) {
    return errorResponse("Billing is not configured yet. Add your Dodo Payments keys.", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid request body");
  }

  const productId = productIdForPlan((body as { planId?: unknown } | null)?.planId);
  if (!productId) return errorResponse("Unknown plan", 400);

  // Optional override (e.g. DODO_BILLING_CURRENCY=USD) — useful in test mode
  // when a specific regional payment rail is not enabled for the merchant yet.
  const rawCurrency = process.env.DODO_BILLING_CURRENCY;
  const billingCurrency =
    rawCurrency === "USD" || rawCurrency === "INR" || rawCurrency === "EUR" || rawCurrency === "GBP"
      ? rawCurrency
      : undefined;

  const db = await getDb();
  const rows = await db
    .select({ dodoCustomerId: schema.users.dodoCustomerId })
    .from(schema.users)
    .where(eq(schema.users.email, user.email))
    .limit(1);
  const existingCustomerId = rows[0]?.dodoCustomerId;

  try {
    const session = await getDodo().checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: existingCustomerId
        ? { customer_id: existingCustomerId }
        : { email: user.email, name: user.name ?? undefined },
      subscription_data: { trial_period_days: PRO_TRIAL_DAYS },
      billing_currency: billingCurrency,
      metadata: { user_email: user.email },
      return_url: `${appUrl()}/dashboard/billing?checkout=success`,
      cancel_url: `${appUrl()}/pricing`,
    });

    if (!session.checkout_url) {
      return errorResponse("Checkout URL was not returned", 502);
    }

    return NextResponse.json({
      checkoutUrl: session.checkout_url,
      sessionId: session.session_id,
    });
  } catch (error) {
    console.error("[billing/checkout]", error);
    return errorResponse("Could not start checkout", 500);
  }
}
