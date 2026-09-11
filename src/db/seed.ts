import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { RunStep } from "@/db/schema";
import { TOOL_CATALOG } from "@/agent/tools/catalog";
import { computeNextRun } from "@/agent/schedule";

/** Mirror the catalog into the `tools` table (idempotent). */
export async function ensureToolsSeeded(): Promise<void> {
  const db = await getDb();
  const existing = await db
    .select({ id: schema.tools.id })
    .from(schema.tools)
    .limit(1)
    .catch(() => []);
  if (existing.length > 0) return;

  await db.insert(schema.tools).values(
    TOOL_CATALOG.map((tool) => ({
      slug: tool.slug,
      name: tool.name,
      description: tool.description,
      icon: tool.icon,
      category: tool.category,
      color: tool.color,
      requiresAuth: tool.requiresAuth,
      provider: tool.provider,
      toolkit: tool.toolkit ?? null,
      actions: tool.actions,
    })),
  );
}

const AGENTS = [
  {
    agentId: "demo-reddit-radar",
    name: "Reddit Trend Radar",
    agentImage:
      "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=demo-reddit-radar",
    description:
      "Finds the top trending AI topics on Reddit, summarizes them and files a report before your first coffee.",
    objective:
      "Surface the five most relevant AI discussions from Reddit in the last 24 hours, summarize why each matters, and deliver a digest with links.",
    instructions:
      "1. Fetch the top posts from r/artificial and r/technology for the last 24 hours.\n2. Remove duplicates and low-signal posts.\n3. Rank the remaining posts by relevance to AI agents and automation.\n4. Summarize each of the top five in two sentences.\n5. Write the full report to a Google Doc titled with today's date.\n6. Send a short digest with the document link to the user's personal Slack channel.\n7. If a tool fails, retry once and note it in the report.",
    tools: ["reddit", "googledocs", "slack", "web_search"],
    skills: ["Web research", "Summarization", "Document automation", "Notifications"],
    outputFormat:
      "Markdown report with an executive summary, a ranked list of five findings with links, and a notes section.",
    schedule: {
      type: "recurring" as const,
      frequency: "daily" as const,
      time: "08:00",
      timeZone: "UTC",
    },
    status: "active",
    composioSessionId: "",
    maxSteps: 8,
  },
  {
    agentId: "demo-inbox-digest",
    name: "Inbox Zero Digest",
    agentImage:
      "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=demo-inbox-digest",
    description:
      "Reads every unread email, flags what is urgent and sends a clean digest before you open your laptop.",
    objective:
      "Summarize all unread Gmail threads into one digest, highlighting anything urgent and anything that needs a reply today.",
    instructions:
      "1. Fetch all unread Gmail threads from the last 3 days.\n2. Summarize each thread in one line.\n3. Flag messages containing deadlines or direct questions as urgent.\n4. Group the digest into Urgent, Needs reply, and FYI.\n5. Send the digest to the user's Slack DM.\n6. Never mark anything as read automatically.",
    tools: ["gmail", "slack"],
    skills: ["Email triage", "Summarization", "Notifications"],
    outputFormat: "Compact markdown digest grouped by urgency, with sender and subject.",
    schedule: {
      type: "recurring" as const,
      frequency: "daily" as const,
      time: "07:30",
      timeZone: "UTC",
    },
    status: "active",
    composioSessionId: "",
    maxSteps: 6,
  },
  {
    agentId: "demo-price-watcher",
    name: "Competitor Price Watcher",
    agentImage:
      "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=demo-price-watcher",
    description:
      "Browses competitor pricing pages every week, detects changes and reports a diff with exact numbers.",
    objective:
      "Watch the pricing pages of the three main competitors and report any plan, price or packaging change since the last run.",
    instructions:
      "1. Open each competitor pricing page in the cloud browser.\n2. Extract every plan name, price and headline limit.\n3. Compare with the snapshot from the previous run.\n4. Report added, removed and changed plans with exact numbers.\n5. Post the diff to the team Slack channel.\n6. If a page fails to load, retry once with a longer wait.",
    tools: ["browserbase", "slack"],
    skills: ["Browser automation", "Competitive analysis", "Reporting"],
    outputFormat: "Markdown diff report with a change table and a one-paragraph summary.",
    schedule: {
      type: "recurring" as const,
      frequency: "weekly" as const,
      time: "10:00",
      dayOfWeek: 1,
      timeZone: "UTC",
    },
    status: "paused",
    composioSessionId: "",
    maxSteps: 10,
  },
];

const REDDIT_REPORT = `# Reddit Trend Radar — daily digest

## Overview
The top five AI discussions from the last 24 hours were collected from r/artificial and r/technology. Agent reliability and scheduled background work dominate the conversation today.

## Key findings
1. **Background agents replace morning routines** — r/artificial's top post shows a creator automating their news digest with a scheduled agent. 4,821 upvotes.
2. **Local vs frontier models for tool calling** — a detailed benchmark thread compares a 7B local model with frontier APIs; the gap is now mostly in error recovery. 3,106 upvotes.
3. **Competitor price monitoring is a killer use case** — an indie builder reports saving hours weekly with a browser agent that watches pricing pages. 2,198 upvotes.
4. **Error recovery is the real agent problem** — practitioners agree that robust retries matter more than prompt tuning. 1,874 upvotes.
5. **Cloud browser automation is eating manual QA** — r/technology's top thread tracks the shift toward browser agents for regression testing. 2,870 upvotes.

## Actions taken
- REDDIT_GET_TOP_POSTS — pulled 10 posts across two subreddits
- GOOGLEDOCS_CREATE_DOCUMENT — wrote this report to Google Docs
- SLACK_SEND_MESSAGE — posted the digest with the document link

## Notes
No failures. Next run is scheduled for tomorrow at 08:00.`;

const INBOX_REPORT = `# Inbox Zero Digest — 5 unread threads

## Overview
Five unread threads were summarized; one needs your approval before end of day.

**Urgent**
- **Priya Sharma** — Q3 launch: final approval needed *by EOD tomorrow*.
- **GitHub** — PR #482 “feat: scheduled run dispatcher” is waiting for your review.

**Needs reply**
- **Maya Chen** — partnership proposal: the vendor team is aligned and awaiting your slot.

**FYI**
- **Stripe** — invoice #INV-2041 for $249.00 paid.
- **Design team** — new dashboard mockups are ready.
- **Calendar** — board sync invitation for Thursday 3:00 PM.

## Actions taken
- GMAIL_FETCH_EMAILS — read 8 threads (5 unread)
- SLACK_SEND_MESSAGE — digest delivered to your DM

## Notes
Two threads were marked important but do not need action today.`;

const FAILED_STEPS: RunStep[] = [
  {
    index: 0,
    type: "info",
    title: "Run started",
    detail: "Engine: Groovy Simulation (built-in) · 2 tools available",
    at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    index: 1,
    type: "tool_call",
    title: "Using BROWSER_RESEARCH",
    toolSlug: "BROWSER_RESEARCH",
    input: { task: "Open competitor pricing pages and extract plans" },
    at: new Date(Date.now() - 3 * 60 * 60 * 1000 + 2000).toISOString(),
  },
  {
    index: 2,
    type: "tool_result",
    title: "Browser research: timeout",
    toolSlug: "BROWSER_RESEARCH",
    detail: "Browser run out of time",
    output: { status: "timeout", error: "Browser run out of time" },
    at: new Date(Date.now() - 3 * 60 * 60 * 1000 + 120000).toISOString(),
  },
  {
    index: 3,
    type: "error",
    title: "Run failed",
    detail: "Browser run out of time",
    at: new Date(Date.now() - 3 * 60 * 60 * 1000 + 121000).toISOString(),
  },
];

function completedSteps(toolbar: string): RunStep[] {
  const base = Date.now() - 6 * 60 * 60 * 1000;
  return [
    {
      index: 0,
      type: "info",
      title: "Run started",
      detail: "Engine: Groovy Simulation (built-in) · tools ready",
      at: new Date(base).toISOString(),
    },
    {
      index: 1,
      type: "tool_call",
      title: "Using REDDIT_GET_TOP_POSTS",
      toolSlug: "REDDIT_GET_TOP_POSTS",
      input: { subreddit: "artificial", time_filter: "day", limit: 5 },
      at: new Date(base + 1500).toISOString(),
    },
    {
      index: 2,
      type: "tool_result",
      title: "Pulled top posts from r/artificial",
      toolSlug: "REDDIT_GET_TOP_POSTS",
      detail: "5 posts collected",
      output: { subreddit: "artificial", posts: 5 },
      durationMs: 820,
      at: new Date(base + 2500).toISOString(),
    },
    {
      index: 3,
      type: "tool_call",
      title: `Using ${toolbar}`,
      toolSlug: toolbar,
      input: {},
      at: new Date(base + 4000).toISOString(),
    },
    {
      index: 4,
      type: "tool_result",
      title: toolbar === "GOOGLEDOCS_CREATE_DOCUMENT" ? "Created Google Doc" : "Sent Slack message",
      toolSlug: toolbar,
      detail: "Completed successfully",
      output: { status: "success" },
      durationMs: 640,
      at: new Date(base + 5000).toISOString(),
    },
    {
      index: 5,
      type: "final",
      title: "Deliverable ready",
      detail: "Report written and notification delivered",
      output: { markdown: "" },
      at: new Date(base + 6000).toISOString(),
    },
  ];
}

/** Creates a complete, believable workspace for the one-click demo. */
export async function seedDemoWorkspace(userEmail: string): Promise<void> {
  await ensureToolsSeeded();
  const db = await getDb();

  const existingAgents = await db
    .select({ id: schema.agentConfig.id })
    .from(schema.agentConfig)
    .where(eq(schema.agentConfig.userEmail, userEmail))
    .limit(1);
  if (existingAgents.length > 0) return;

  for (const agent of AGENTS) {
    await db.insert(schema.agentConfig).values({
      userEmail,
      agentId: agent.agentId,
      name: agent.name,
      agentImage: agent.agentImage,
      description: agent.description,
      instructions: agent.instructions,
      objective: agent.objective,
      tools: agent.tools,
      skills: agent.skills,
      schedule: agent.schedule,
      outputFormat: agent.outputFormat,
      status: agent.status,
      composioSessionId: "",
      maxSteps: agent.maxSteps,
    });

    const next = computeNextRun(agent.schedule);
    if (agent.status === "active" && next) {
      await db.insert(schema.agentRun).values({
        agentId: agent.agentId,
        userEmail,
        scheduleFor: next,
        timeZone: agent.schedule.timeZone,
        status: "scheduled",
        trigger: "schedule",
      });
    }
  }

  // Connections matching the tutorial demo.
  for (const slug of ["reddit", "googledocs", "slack"]) {
    await db.insert(schema.toolConnections).values({
      userEmail,
      slug,
      accountLabel: slug === "slack" ? "groovy-workspace" : "you@gmail.com",
      status: "connected",
      externalId: `demo_${slug}`,
    });
  }

  // Completed runs.
  const now = Date.now();
  const completedRuns = [
    {
      agentId: "demo-reddit-radar",
      output: REDDIT_REPORT,
      steps: completedSteps("GOOGLEDOCS_CREATE_DOCUMENT"),
      at: new Date(now - 6 * 60 * 60 * 1000),
    },
    {
      agentId: "demo-inbox-digest",
      output: INBOX_REPORT,
      steps: completedSteps("SLACK_SEND_MESSAGE"),
      at: new Date(now - 26 * 60 * 60 * 1000),
    },
    {
      agentId: "demo-inbox-digest",
      output: INBOX_REPORT,
      steps: completedSteps("SLACK_SEND_MESSAGE"),
      at: new Date(now - 50 * 60 * 60 * 1000),
    },
  ];

  for (const run of completedRuns) {
    await db.insert(schema.agentRun).values({
      agentId: run.agentId,
      userEmail,
      scheduleFor: run.at,
      timeZone: "UTC",
      status: "completed",
      trigger: "schedule",
      output: run.output,
      steps: run.steps,
      queuedAt: run.at,
      startedAt: run.at,
      completedAt: new Date(run.at.getTime() + 45_000),
      createdAt: run.at,
    });
  }

  // A failed run for the price watcher.
  const failedAt = new Date(now - 3 * 60 * 60 * 1000);
  await db.insert(schema.agentRun).values({
    agentId: "demo-price-watcher",
    userEmail,
    scheduleFor: failedAt,
    timeZone: "UTC",
    status: "failed",
    trigger: "schedule",
    error: "Browser run out of time",
    steps: FAILED_STEPS,
    queuedAt: failedAt,
    startedAt: failedAt,
    completedAt: new Date(failedAt.getTime() + 121_000),
    createdAt: failedAt,
  });

  // Chat history.
  await db.insert(schema.agentMessages).values([
    {
      agentId: "demo-reddit-radar",
      userEmail,
      role: "user",
      content: "hi what can you do?",
    },
    {
      agentId: "demo-reddit-radar",
      userEmail,
      role: "assistant",
      content:
        "Hi! I'm **Reddit Trend Radar**.\n\nI scan Reddit for the fastest-rising AI discussions every morning, summarize the top five and write a report to Google Docs before notifying you on Slack.\n\nAsk me for the latest digest or hit **Run now**.",
    },
  ]);
}
