import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { errorResponse, requireApiUser } from "@/lib/api";
import { appUrl, dodoEnabled, getDodo } from "@/lib/dodo";

/**
 * Mint a Dodo Payments customer-portal session for the signed-in user.
 *
 * The portal is hosted by Dodo and handles invoices, payment methods, plan
 * changes and cancellations. Session links expire — mint one per click.
 */
export async function POST() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  if (!dodoEnabled()) {
    return errorResponse("Billing is not configured yet.", 503);
  }

  const db = await getDb();
  const rows = await db
    .select({ dodoCustomerId: schema.users.dodoCustomerId })
    .from(schema.users)
    .where(eq(schema.users.email, auth.user.email))
    .limit(1);
  const customerId = rows[0]?.dodoCustomerId;

  if (!customerId) {
    return errorResponse("No billing account yet — start a subscription first.", 400);
  }

  try {
    const session = await getDodo().customers.customerPortal.create(customerId, {
      return_url: `${appUrl()}/dashboard/billing`,
    });
    return NextResponse.json({ url: session.link });
  } catch (error) {
    console.error("[billing/portal]", error);
    return errorResponse("Could not open the billing portal", 500);
  }
}
