import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import {
  handleWebhookPayload,
  verifyWebhookPayload,
  type WebhookHandlerConfig,
} from "@dodopayments/core";
import { getDb, schema } from "@/db";
import { upsertAppUser } from "@/lib/auth";
import { dodoWebhookEnabled } from "@/lib/dodo";
import { PRO_USAGE_CREDITS } from "@/lib/plans";

/**
 * Dodo Payments webhook — the only place entitlements are granted.
 *
 * Handlers receive the FULL event envelope ({ type, timestamp, data }); the
 * domain object lives on `.data`. Updates are absolute (`plan`,
 * `subscriptionStatus`, `usageCredits`), so redelivered events are idempotent.
 *
 * Events handled:
 *   subscription.active / renewed / plan_changed / updated -> pro access
 *   subscription.on_hold                                  -> keep access (dunning)
 *   subscription.cancelled / expired                      -> back to free
 *   payment.succeeded                                     -> link customer id
 */

type CustomerLike = {
  customer_id?: string;
  email?: string;
  name?: string;
};

type SubscriptionLike = {
  subscription_id?: string;
  product_id?: string;
  status?: string;
  customer?: CustomerLike;
  metadata?: Record<string, string>;
};

function asSubscription(payload: unknown): SubscriptionLike {
  return (payload ?? {}) as SubscriptionLike;
}

async function findUser(opts: { customerId?: string; email?: string }) {
  const db = await getDb();
  if (opts.customerId) {
    const byCustomer = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.dodoCustomerId, opts.customerId))
      .limit(1);
    if (byCustomer[0]) return byCustomer[0];
  }
  if (opts.email) {
    const byEmail = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, opts.email))
      .limit(1);
    if (byEmail[0]) return byEmail[0];
  }
  return null;
}

async function applySubscriptionState(input: {
  customerId?: string;
  email?: string;
  subscriptionId?: string;
  status?: string;
  plan?: "pro" | "free";
  resetCredits?: boolean;
}) {
  const existing = await findUser({ customerId: input.customerId, email: input.email });
  let userId = existing?.id ?? null;

  if (userId === null && input.email) {
    // The app profile row is created on first session resolution, but a
    // webhook can beat that (checkout completes before the dashboard is
    // opened). Dodo is signature-verified, so the customer email is
    // trustworthy: create the profile now so the entitlement is never lost.
    const profile = await upsertAppUser({
      email: input.email.toLowerCase(),
      name: null,
      imageUrl: null,
    });
    userId = profile.id;
  }

  if (userId === null) {
    // Throwing surfaces the problem to Dodo (non-2xx → retry) instead of
    // silently dropping an entitlement the customer paid for.
    throw new Error(
      `[webhooks/dodo] no user matched (fields: ${JSON.stringify({
        customerId: input.customerId ?? null,
        email: input.email ?? null,
      })})`,
    );
  }

  const patch: Partial<typeof schema.users.$inferInsert> = {};
  if (input.customerId) patch.dodoCustomerId = input.customerId;
  if (input.subscriptionId) patch.dodoSubscriptionId = input.subscriptionId;
  if (input.status) patch.subscriptionStatus = input.status;
  if (input.plan) patch.plan = input.plan;
  if (input.resetCredits) patch.usageCredits = PRO_USAGE_CREDITS;

  if (Object.keys(patch).length === 0) return;

  const db = await getDb();
  await db.update(schema.users).set(patch).where(eq(schema.users.id, userId));
}

type EventFields = {
  customerId?: string;
  email?: string;
  subscriptionId?: string;
  status?: string;
};

function eventFields(event: unknown): EventFields {
  // Handlers receive the full webhook event ({ type, timestamp, data }); the
  // domain object lives on `.data`.
  const data = (event as { data?: unknown })?.data;
  if (!data || typeof data !== "object") {
    throw new Error(
      `webhook event is missing data (event keys: ${Object.keys(event as object).join(", ")})`,
    );
  }
  const domain = asSubscription(data);
  return {
    customerId: domain.customer?.customer_id,
    email: domain.metadata?.user_email ?? domain.customer?.email,
    subscriptionId: domain.subscription_id,
    status: domain.status,
  };
}

const handlers = {
  onSubscriptionActive: async (event) =>
    applySubscriptionState({
      ...eventFields(event),
      plan: "pro",
      status: "active",
      resetCredits: true,
    }),

  onSubscriptionRenewed: async (event) =>
    applySubscriptionState({
      ...eventFields(event),
      plan: "pro",
      status: "active",
      resetCredits: true,
    }),

  onSubscriptionPlanChanged: async (event) =>
    applySubscriptionState({
      ...eventFields(event),
      plan: "pro",
      status: "active",
    }),

  onSubscriptionUpdated: async (event) => {
    const fields = eventFields(event);
    if (fields.status === "cancelled" || fields.status === "expired") {
      await applySubscriptionState({ ...fields, plan: "free" });
      return;
    }
    await applySubscriptionState(fields);
  },

  onSubscriptionOnHold: async (event) =>
    // Dunning in progress — keep Pro access until the subscription is
    // cancelled or expires.
    applySubscriptionState({ ...eventFields(event), status: "on_hold" }),

  onSubscriptionCancelled: async (event) =>
    applySubscriptionState({ ...eventFields(event), plan: "free", status: "cancelled" }),

  onSubscriptionExpired: async (event) =>
    applySubscriptionState({ ...eventFields(event), plan: "free", status: "expired" }),

  onSubscriptionFailed: async (event) =>
    applySubscriptionState({ ...eventFields(event), status: "failed" }),

  onPaymentSucceeded: async (event) => {
    // One-time purchases only; subscription access starts on subscription.active.
    // Still useful for linking the Dodo customer id on first checkout.
    const fields = eventFields(event);
    await applySubscriptionState({
      customerId: fields.customerId,
      email: fields.email,
    });
  },
} satisfies Omit<WebhookHandlerConfig, "webhookKey">;

export async function POST(request: NextRequest) {
  if (!dodoWebhookEnabled()) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  // Official verify → parse → dispatch path, with observable responses: the
  // adapter returned body-less 200s even when a handler did nothing, which made
  // webhook debugging impossible.
  const body = await request.text();
  const headers = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
  };

  let payload;
  try {
    payload = await verifyWebhookPayload({
      webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? "",
      headers,
      body,
    });
  } catch {
    console.error("[webhooks/dodo] signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    await handleWebhookPayload(payload, {
      webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? "",
      ...handlers,
    });
    return NextResponse.json({ received: true, type: payload.type });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[webhooks/dodo] handler failed:", message);
    return NextResponse.json(
      {
        error: "Webhook processing failed",
        ...(process.env.NODE_ENV !== "production"
          ? {
              detail: message,
              payloadPreview: JSON.stringify(payload).slice(0, 400),
            }
          : {}),
      },
      { status: 500 },
    );
  }
}
