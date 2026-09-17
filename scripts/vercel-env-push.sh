#!/usr/bin/env bash
# Push production env vars from .env.local into the linked Vercel project.
# Usage: bash scripts/vercel-env-push.sh
set -euo pipefail

read_var() { # read VAR from .env.local, strip surrounding quotes
  local line
  line=$(grep -m1 "^$1=" .env.local || true)
  line="${line#*=}"
  if [[ ($line == \"*\" && $line == *\" ) || ($line == \'*\' && $line == *\' ) ]]; then :; fi
  # strip matching quotes
  if [[ $line == \"* ]]; then line="${line%\"}"; line="${line#\"}"; fi
  if [[ $line == \'* ]]; then line="${line%\'}"; line="${line#\'}"; fi
  printf '%s' "$line"
}

# Keys synced verbatim from .env.local (runtime + build-time, incl. NEXT_PUBLIC_*)
SYNC_KEYS=(
  OPENCODE_GO_API_KEY OPENCODE_GO_MODEL LLM_PROVIDER
  GROQ_API_KEY GROQ_MODEL BROWSERBASE_API_KEY COMPOSIO_API_KEY
  DATABASE_URL
  BETTER_AUTH_SECRET
  DODO_PAYMENTS_API_KEY DODO_PAYMENTS_ENVIRONMENT DODO_PAYMENTS_WEBHOOK_KEY
  DODO_PRODUCT_PRO_MONTHLY DODO_PRODUCT_PRO_YEARLY
  NEXT_PUBLIC_DODO_PAYMENTS_PUBLISHABLE_KEY NEXT_PUBLIC_DODO_MODE
  DODO_BILLING_CURRENCY
  GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET
  GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET
)

echo "== Syncing ${#SYNC_KEYS[@]} keys from .env.local to Vercel (production) =="
for key in "${SYNC_KEYS[@]}"; do
  value=$(read_var "$key")
  if [[ -z "$value" ]]; then
    echo "  - $key: not set locally, skipping"
    continue
  fi
  printf '%s' "$value" | npx vercel env add "$key" production 2>&1 | grep -v '^$' | tail -1
  echo "  ✔ $key"
done

echo "== Lockdown / infra keys =="
printf 'agnihotrisanvi2003@gmail.com' | npx vercel env add AUTH_SIGNUP_ALLOWLIST production >/dev/null 2>&1 && echo "  ✔ AUTH_SIGNUP_ALLOWLIST"

if ! npx vercel env ls production 2>/dev/null | grep -q "CRON_SECRET"; then
  cron_secret=$(openssl rand -hex 32)
  printf '%s' "$cron_secret" | npx vercel env add CRON_SECRET production >/dev/null 2>&1 && echo "  ✔ CRON_SECRET (generated)"
else
  echo "  ✔ CRON_SECRET already set"
fi

echo "== Done. BETTER_AUTH_URL + NEXT_PUBLIC_APP_URL are set after the first deploy reveals the URL."
