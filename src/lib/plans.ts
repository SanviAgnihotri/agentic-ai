/**
 * Public plan catalogue — display copy and prices.
 *
 * This file is client-safe: it mirrors the Dodo Payments product catalogue for
 * the pricing UI. The amount actually charged comes from the Dodo product;
 * when you change a price in the Dodo dashboard, reconcile it here too.
 */

export type PlanId = "free" | "pro";
export type BillingInterval = "monthly" | "yearly";
export type CheckoutPlanId = "pro_monthly" | "pro_yearly";

export const PRO_PLAN_SLUG: PlanId = "pro";

export const PRO_TRIAL_DAYS = 7;
export const PRO_MONTHLY_PRICE = 12;
export const PRO_YEARLY_PRICE = 120;

export const FREE_AGENT_LIMIT = 3;
export const FREE_USAGE_CREDITS = 200;
export const PRO_USAGE_CREDITS = 2000;

/** ~17% off with yearly billing (2 months free). */
export const YEARLY_SAVINGS_PERCENT = Math.round(
  (1 - PRO_YEARLY_PRICE / (PRO_MONTHLY_PRICE * 12)) * 100,
);

export const CHECKOUT_PLAN_IDS: Record<BillingInterval, CheckoutPlanId> = {
  monthly: "pro_monthly",
  yearly: "pro_yearly",
};

export interface PlanFeature {
  label: string;
}

export const FREE_FEATURES: PlanFeature[] = [
  { label: `${FREE_AGENT_LIMIT} agents` },
  { label: `${FREE_USAGE_CREDITS} usage credits / month` },
  { label: "Demo-mode execution" },
  { label: "All 29 integrations" },
  { label: "Community support" },
];

export const PRO_FEATURES: PlanFeature[] = [
  { label: "Live autonomous agent runs" },
  { label: `${PRO_USAGE_CREDITS} usage credits / month` },
  { label: "Priority support" },
  { label: "Unlimited scheduled runs" },
  { label: "Everything in Free" },
];

export function priceForInterval(interval: BillingInterval): number {
  return interval === "yearly" ? PRO_YEARLY_PRICE : PRO_MONTHLY_PRICE;
}

export function intervalLabel(interval: BillingInterval): string {
  return interval === "yearly" ? "year" : "month";
}
