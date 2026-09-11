import "server-only";
import DodoPayments from "dodopayments";

/**
 * Dodo Payments server client.
 *
 * Server-only: the API key is a secret (`dodo_test_...` / `dodo_live_...`) and
 * must never reach the browser. Import this module only from route handlers
 * and server components.
 */

export const dodoEnvironment =
  process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode";

/** Defaulting to test mode is deliberate — a missing or misspelled variable
 *  must never silently resolve to live mode. */

export function dodoEnabled(): boolean {
  return Boolean(process.env.DODO_PAYMENTS_API_KEY);
}

export function dodoWebhookEnabled(): boolean {
  return dodoEnabled() && Boolean(process.env.DODO_PAYMENTS_WEBHOOK_KEY);
}

let client: DodoPayments | null = null;

export function getDodo(): DodoPayments {
  const bearerToken = process.env.DODO_PAYMENTS_API_KEY;
  if (!bearerToken) {
    throw new Error("DODO_PAYMENTS_API_KEY is not set");
  }
  client ??= new DodoPayments({
    bearerToken,
    environment: dodoEnvironment,
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY,
  });
  return client;
}

export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}
