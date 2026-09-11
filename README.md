<div align="center">
  <img src="public/logo.svg" alt="Groovy AI" width="88" />
  <h1>Groovy AI</h1>
  <p><strong>Describe any recurring task in plain English — get an autonomous agent that runs it on a schedule.</strong></p>
</div>

---

Groovy AI turns one sentence into a fully configured agent: name, objective, numbered
instructions, tools, output format and schedule. Agents then work on their own —
researching live websites, calling integrations, and reporting results while you sleep.

Works with **zero API keys**: a built-in simulation engine keeps the whole product
usable for demos and local development.

## ✨ What it does

- **Prompt → agent** — natural language becomes a complete, schema-validated config; a clarification wizard asks only when a decision truly matters.
- **Autonomous execution** — a step-by-step tool-calling loop persists every thought, tool call and result to the run timeline.
- **Chat with your agents** — ask about results or kick off fresh work from the chat drawer.
- **29 integrations** — Gmail, Slack, Google Docs/Calendar/Sheets/Drive, Notion, GitHub, Linear, Stripe and more, via Composio.
- **Browser automation** — live website research and monitoring via Browserbase.
- **Scheduling** — built-in scheduler plus Inngest, with atomic run claiming so every job fires exactly once.
- **Dashboard** — stats, 7-day activity chart, AI briefing, upcoming runs and latest results.

## 🧱 Built with

| Layer | Tech |
|---|---|
| **Framework** | Next.js 16 (App Router), React 19, TypeScript |
| **UI** | Tailwind CSS v4, shadcn/ui, Lucide, Motion |
| **Data** | Drizzle ORM — embedded PGlite locally, any Postgres (Aiven/Neon) in production |
| **AI** | OpenCode Go (DeepSeek), Groq, OpenAI, Gemini — or the built-in mock |
| **Automation** | Composio (integrations), Browserbase (browser), Inngest (background jobs) |
| **Auth** | Better Auth — email+password & GitHub sign-in (invite-only: sign-up disabled, allowlist-gated) |

## 🚀 Getting started

Requires [Bun](https://bun.sh) ≥ 1.1.

```bash
bun install
bun dev
```

Open <http://localhost:3000> and click **“Explore the live demo workspace”** — it seeds a
demo user with sample agents, run history and connected tools. No keys required.

### Optional: real AI & integrations

Everything degrades gracefully when a key is missing, so add only what you have:

```bash
cp .env.example .env.local
```

| Variable | Purpose |
|---|---|
| `OPENCODE_GO_API_KEY` | Recommended live AI (DeepSeek/Kimi/GLM/Qwen) |
| `GROQ_API_KEY` | Free-tier AI alternative |
| `DATABASE_URL` | Hosted Postgres (defaults to embedded PGlite) |
| `COMPOSIO_API_KEY` | Real OAuth + real tool execution |
| `BROWSERBASE_API_KEY` | Real cloud browser sessions |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Background jobs |
| `CRON_SECRET` | Protects the scheduler endpoint |

The full annotated list lives in [`.env.example`](.env.example).

## 📁 Project structure

```
src/app            routes + API handlers
src/components     UI — dashboard, agents, runs, integrations, templates, shared
src/agent          agent domain: AI providers, engine, tools, browser, integrations, prompts
src/db             Drizzle schema + database factory
src/inngest        background functions
skills/            installed agent skills (single source of truth)
```

## 🧪 Scripts

```bash
bun dev              # start the app
bun run build        # production build
bun run typecheck    # tsc --noEmit
bun run lint         # eslint
bun run db:generate  # generate SQL migrations from the schema
bun run db:migrate   # apply migrations
bun run db:studio    # Drizzle Studio
bun run inngest      # Inngest dev server
```

## ☁️ Deploy

1. Import the repo into Vercel — Bun is auto-detected from `bun.lock`.
2. Set `DATABASE_URL` (Aiven's free plan works) and one AI provider key.
3. Optionally add Composio/Browserbase keys — `vercel.json` already registers the
   scheduler cron.
