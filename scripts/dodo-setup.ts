/**
 * Ensures the Groovy AI Pro products exist in Dodo Payments.
 *
 * Run against test mode:
 *   bun --env-file=.env.local scripts/dodo-setup.ts
 *
 * Prints the product ids to copy into .env.local:
 *   DODO_PRODUCT_PRO_MONTHLY=pdt_...
 *   DODO_PRODUCT_PRO_YEARLY=pdt_...
 *
 * The dashboard is still the source of truth for pricing — this script only
 * creates the products when they are missing and reuses them by name.
 */
import DodoPayments from "dodopayments";

const environment =
  process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode";

const bearerToken = process.env.DODO_PAYMENTS_API_KEY;
if (!bearerToken) {
  throw new Error("DODO_PAYMENTS_API_KEY is not set (use --env-file=.env.local)");
}

const client = new DodoPayments({ bearerToken, environment });

const PRODUCTS = [
  {
    envKey: "DODO_PRODUCT_PRO_MONTHLY",
    name: "Groovy AI Pro — Monthly",
    price: 1200, // $12.00 in cents
    interval: "Month" as const,
  },
  {
    envKey: "DODO_PRODUCT_PRO_YEARLY",
    name: "Groovy AI Pro — Yearly",
    price: 12000, // $120.00 in cents (2 months free)
    interval: "Year" as const,
  },
];

const page = await client.products.list({ page_size: 100 });
const existing = page.items ?? [];

for (const desired of PRODUCTS) {
  const match = existing.find((product) => product.name === desired.name);
  if (match) {
    console.log(`${desired.envKey}=${match.product_id} # reused existing`);
    continue;
  }

  const product = await client.products.create({
    name: desired.name,
    description:
      "Groovy AI Pro — live autonomous agent runs, a bigger monthly credit budget and priority support.",
    tax_category: "saas",
    price: {
      type: "recurring_price",
      currency: "USD",
      price: desired.price,
      discount: 0,
      payment_frequency_count: 1,
      payment_frequency_interval: desired.interval,
      subscription_period_count: 1,
      subscription_period_interval: desired.interval,
      purchasing_power_parity: false,
    },
  });

  console.log(`${desired.envKey}=${product.product_id} # created`);
}

// ---------------------------------------------------------------------------
// Webhook endpoint — Dodo signs every delivery; the app verifies with this key.
// Set DODO_WEBHOOK_URL to the public deployment URL, or leave it to default to
// NEXT_PUBLIC_APP_URL (localhost works for the signed-payload test script).
// ---------------------------------------------------------------------------
const webhookUrl =
  process.env.DODO_WEBHOOK_URL ??
  `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/webhooks/dodo`;

const webhookPage = [];
for await (const endpoint of client.webhooks.list()) webhookPage.push(endpoint);
const webhooks = webhookPage;

let webhook = webhooks.find((candidate) => candidate.url === webhookUrl);
if (!webhook) {
  try {
    webhook = await client.webhooks.create({
      url: webhookUrl,
      description: "Groovy AI billing (created by scripts/dodo-setup.ts)",
    });
    console.log(`# webhook created for ${webhookUrl}`);
  } catch (error) {
    console.error(`# could not create webhook for ${webhookUrl}:`, error);
  }
}

if (webhook) {
  const { secret } = await client.webhooks.retrieveSecret(webhook.id);
  console.log(`DODO_PAYMENTS_WEBHOOK_KEY=${secret}`);
}
