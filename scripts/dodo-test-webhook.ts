/**
 * End-to-end test for the Dodo Payments webhook handler.
 *
 * 1. Creates a fresh free account.
 * 2. Generates a schema-valid `subscription.active` payload from the adapter's
 *    own Zod schema, signs it with the webhook signing key (Standard Webhooks
 *    spec), and POSTs it to the local app.
 * 3. Verifies the user is upgraded to Pro.
 *
 * Usage: bun --env-file=.env.local scripts/dodo-test-webhook.ts
 */
import { SubscriptionActivePayloadSchema } from "@dodopayments/core";
import { Webhook } from "standardwebhooks";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const secret = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
if (!secret) {
  throw new Error("DODO_PAYMENTS_WEBHOOK_KEY is not set (use --env-file=.env.local)");
}

// ---------------------------------------------------------------------------
// Minimal Zod v3 sample generator — walks the adapter's own schema so the test
// payload satisfies every required field without hand-writing ~40 properties.
// ---------------------------------------------------------------------------
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
      if (checks.some((check) => check.kind === "datetime")) {
        return "2026-01-01T00:00:00Z";
      }
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

const email = `dodo-test-${Date.now()}@groovy.ai`;
const password = "dodo-test-password-123";

// 1. Fresh free account (sets the session cookie).
const signUp = await fetch(`${baseUrl}/api/auth/sign-up`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Dodo Webhook Test", email, password }),
});
if (!signUp.ok) {
  throw new Error(`sign-up failed: ${signUp.status} ${await signUp.text()}`);
}
const cookie = signUp.headers.get("set-cookie")?.split(";")[0] ?? "";
console.log("created free user:", email);

// 2. Build, validate and sign the event.
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
payload.data.subscription_id = `sub_test_${Date.now()}`;
payload.data.product_id = process.env.DODO_PRODUCT_PRO_MONTHLY;
payload.data.status = "active";
payload.data.customer = {
  customer_id: `cus_test_${Date.now()}`,
  email,
  name: "Dodo Webhook Test",
};
payload.data.metadata = { user_email: email };

const parsed = SubscriptionActivePayloadSchema.safeParse(payload);
if (!parsed.success) {
  console.error("test payload failed schema validation:", parsed.error.issues.slice(0, 5));
  process.exit(1);
}

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

// 3. Verify the entitlement landed.
const me = await fetch(`${baseUrl}/api/users`, { headers: { cookie } });
const data = (await me.json()) as {
  user?: { plan?: string; usageCredits?: number };
};
console.log("plan after webhook:", data.user?.plan, "| credits:", data.user?.usageCredits);

if (data.user?.plan !== "pro") {
  console.error("FAILED: expected plan to be pro");
  process.exit(1);
}
console.log("PASS: free user upgraded to Pro by the signed webhook");
