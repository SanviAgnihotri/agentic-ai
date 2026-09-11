/**
 * Replays the latest succeeded subscription payment as a signed
 * `subscription.active` webhook to the local app.
 *
 * Use this after a test payment made while the dev server was unreachable
 * from Dodo (localhost). In production (or with `dodo wh listen`) the real
 * webhook does this automatically.
 *
 * Usage: bun --env-file=.env.local scripts/dodo-replay-subscription.ts [payment_id]
 */
import DodoPayments from "dodopayments";
import { SubscriptionActivePayloadSchema } from "@dodopayments/core";
import { Webhook } from "standardwebhooks";

type AnySchema = {
  _def: {
    typeName: string;
    value?: unknown;
    values?: unknown[];
    type?: AnySchema;
    schema?: AnySchema;
    innerType?: AnySchema;
    shape?: () => Record<string, AnySchema>;
    element?: AnySchema;
    checks?: Array<{ kind: string }>;
    options?: AnySchema[];
  };
};

function sampleFromSchema(schema: AnySchema): unknown {
  const def = schema._def;
  switch (def.typeName) {
    case "ZodString": {
      const checks = def.checks ?? [];
      if (checks.some((check) => check.kind === "datetime")) return "2026-01-01T00:00:00Z";
      return "sample";
    }
    case "ZodNumber":
      return 1;
    case "ZodBoolean":
      return false;
    case "ZodLiteral":
      return def.value;
    case "ZodEnum":
      return def.values?.[0];
    case "ZodArray":
      return [];
    case "ZodObject": {
      const shape = def.shape?.() ?? {};
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(shape)) out[key] = sampleFromSchema(value);
      return out;
    }
    case "ZodOptional":
    case "ZodNullable":
    case "ZodDefault":
      return sampleFromSchema((def.innerType ?? def.type) as AnySchema);
    case "ZodEffects":
      return sampleFromSchema(def.schema as AnySchema);
    case "ZodUnion":
      return sampleFromSchema(def.options?.[0] as AnySchema);
    case "ZodRecord":
      return {};
    default:
      return null;
  }
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const secret = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
if (!secret) throw new Error("DODO_PAYMENTS_WEBHOOK_KEY is not set");

const client = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY,
  environment: process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode",
});

// 1. Find the subscription to replay (latest succeeded, or the id passed in).
const requestedId = process.argv[2];
let paymentId: string | undefined = requestedId;
if (!paymentId) {
  const page = await client.payments.list({ page_size: 20, page_number: 0 });
  paymentId = page.items?.find((p) => p.status === "succeeded" && p.subscription_id)?.payment_id;
}
if (!paymentId) throw new Error("No succeeded subscription payment found");

const payment = await client.payments.retrieve(paymentId);
const subscriptionId = payment.subscription_id;
const customer = payment.customer;
if (!subscriptionId || !customer?.email) {
  throw new Error(`Payment ${paymentId} has no subscription or customer email`);
}
const subscription = await client.subscriptions.retrieve(subscriptionId);

console.log(
  `replaying: payment=${payment.payment_id} subscription=${subscriptionId} status=${subscription.status} customer=${customer.email}`,
);

// 2. Build a schema-valid event carrying the real data.
const payload = sampleFromSchema(
  SubscriptionActivePayloadSchema as unknown as AnySchema,
) as {
  timestamp: string;
  data: Record<string, unknown> & {
    customer?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
};
payload.timestamp = new Date().toISOString();
payload.data.subscription_id = subscriptionId;
payload.data.product_id = subscription.product_id;
payload.data.status = subscription.status;
payload.data.customer = {
  customer_id: customer.customer_id,
  email: customer.email,
  name: customer.name ?? undefined,
};
payload.data.metadata = { user_email: customer.email };

const parsed = SubscriptionActivePayloadSchema.safeParse(payload);
if (!parsed.success) {
  console.error("payload failed schema validation:", parsed.error.issues.slice(0, 5));
  process.exit(1);
}

// 3. Sign and deliver.
const body = JSON.stringify(payload);
const webhook = new Webhook(secret);
const messageId = `msg_${Date.now()}`;
const timestamp = new Date();
const signature = webhook.sign(messageId, timestamp, body);

const response = await fetch(`${baseUrl}/api/webhooks/dodo`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "webhook-id": messageId,
    "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "webhook-signature": signature,
  },
  body,
});
console.log("webhook response:", response.status, await response.text());
