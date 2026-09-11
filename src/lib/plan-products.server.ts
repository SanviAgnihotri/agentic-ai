import "server-only";
import type { CheckoutPlanId } from "@/lib/plans";

/**
 * Server-side map from the public plan slug to the Dodo product id.
 *
 * Never accept a raw `pdt_...` product id from the browser — a caller could
 * then check out against any product in the catalogue. Map an opaque plan slug
 * here instead.
 */

const PRODUCT_IDS: Record<CheckoutPlanId, string | undefined> = {
  pro_monthly: process.env.DODO_PRODUCT_PRO_MONTHLY,
  pro_yearly: process.env.DODO_PRODUCT_PRO_YEARLY,
};

export function productIdForPlan(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return PRODUCT_IDS[value as CheckoutPlanId] ?? null;
}
