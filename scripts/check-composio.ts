/**
 * Verifies the Composio SDK works with the CLI-provisioned key.
 * Reads ~/.composio/user_data.json, never prints the key.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { Composio } from "@composio/core";

async function main() {
  let data: { api_key?: string; base_url?: string } = {};
  try {
    data = JSON.parse(
      readFileSync(`${homedir()}/.composio/user_data.json`, "utf8"),
    ) as { api_key?: string; base_url?: string };
  } catch {
    // No CLI-provisioned file — fall back to COMPOSIO_API_KEY below.
  }
  const apiKey = process.env.COMPOSIO_API_KEY || data.api_key;
  if (!apiKey) throw new Error("No Composio key found");
  console.log("key prefix:", apiKey.slice(0, 4) + "…");

  const composio = new Composio({
    apiKey,
    ...(data.base_url ? { baseURL: data.base_url } : {}),
  });

  const accounts = await composio.connectedAccounts.list({});
  const items = (accounts.items ?? []) as unknown as Array<Record<string, unknown>>;
  console.log("SDK OK — connected accounts:", items.length);
  for (const item of items.slice(0, 10)) {
    const toolkit = item.toolkit as Record<string, unknown> | undefined;
    console.log(" -", toolkit?.slug ?? "?", "| status:", item.status);
  }
}

main().catch((error) => {
  console.error("Verification failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
