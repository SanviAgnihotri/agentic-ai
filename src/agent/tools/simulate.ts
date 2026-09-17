import { toolBySlug } from "./catalog";

/**
 * Demo-mode tool execution.
 *
 * Every action in the catalog has a deterministic simulator that returns the
 * same shape a real Composio tool would. This keeps the whole platform fully
 * functional with no API keys while making runs look realistically useful.
 */

export interface SimulatedResult {
  output: Record<string, unknown>;
  /** One-line summary surfaced in the run report. */
  summary: string;
  /** Link produced by the action, if any. */
  url?: string;
  /** Human-readable step title. */
  title: string;
}

const iso = (offsetMinutes = 0) =>
  new Date(Date.now() + offsetMinutes * 60_000).toISOString();

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function str(args: Record<string, unknown>, key: string, fallback = ""): string {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

const TOPIC_SAMPLES: Array<{ title: string; detail: string; url: string }> = [
  {
    title: "Open-source agent frameworks hit 100k stars",
    detail:
      "The biggest agent repositories crossed 100k GitHub stars this week as teams standardise on tool-calling architectures.",
    url: "https://news.ycombinator.com/item?id=42100421",
  },
  {
    title: "Browser agents learn to fill real checkout forms",
    detail:
      "New benchmark shows browser automation agents completing multi-step web tasks with 92% success, up from 71% last quarter.",
    url: "https://arxiv.org/abs/2509.01234",
  },
  {
    title: "Enterprise RAG budgets shift to agentic workflows",
    detail:
      "62% of surveyed engineering leaders say agentic automation replaced part of their retrieval-augmented generation spend this year.",
    url: "https://www.gartner.com/en/newsroom/press-releases",
  },
  {
    title: "Small models close the gap on structured output",
    detail:
      "7B-parameter models now match last generation's frontier models on JSON-schema adherence benchmarks.",
    url: "https://huggingface.co/blog/structured-output",
  },
  {
    title: "The rise of always-on background agents",
    detail:
      "Recurring agents that run while you sleep are the fastest growing category of personal automation, according to platform data.",
    url: "https://www.producthunt.com/topics/ai-agents",
  },
  {
    title: "Agent observability becomes a first-class product",
    detail:
      "Step-level tracing, tool call logs and replay are now standard features in agent platforms, driven by debugging needs.",
    url: "https://opentelemetry.io/blog/agent-tracing",
  },
];

const SUBREDDIT_POSTS: Record<string, Array<{ title: string; score: number; comments: number }>> = {
  artificial: [
    { title: "I replaced my morning news routine with a background agent", score: 4821, comments: 367 },
    { title: "Benchmark: local 7B model vs frontier API for tool calling", score: 3106, comments: 245 },
    { title: "Show r/artificial: I built an agent that watches competitor pricing", score: 2198, comments: 152 },
    { title: "The hardest part of agents is error recovery, not prompting", score: 1874, comments: 301 },
    { title: "Why scheduled agents are finally useful in 2026", score: 1245, comments: 98 },
  ],
  technology: [
    { title: "Cloud browser automation is eating manual QA", score: 2870, comments: 190 },
    { title: "Ask r/technology: do you trust agents with your inbox?", score: 1642, comments: 512 },
    { title: "The new developer stack: Next.js, Drizzle and background jobs", score: 1104, comments: 87 },
    { title: "Why every SaaS is adding an agent tab", score: 986, comments: 143 },
    { title: "Agent security: OAuth scopes you should never grant", score: 941, comments: 211 },
  ],
};

function researchItems(topic: string) {
  const clean =
    topic
      .replace(/\b(latest|news|today|update[s]?|site:\S+)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim() || topic;
  const titleCase = clean
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
  const slug = slugify(clean) || "topic";

  // Query-aware results so agents researching any subject get on-topic hits
  // instead of the same fixed fixtures.
  const derived = [
    {
      title: `${titleCase}: what happened and what's next`,
      snippet: `The latest reporting on ${clean}, including the key numbers, statements and reactions.`,
      url: `https://www.reuters.com/world/${slug}/`,
      source: "reuters.com",
    },
    {
      title: `Analysis: why ${clean} matters right now`,
      snippet: `Context and expert commentary on ${clean}, with historical comparisons and likely next moves.`,
      url: `https://www.bloomberg.com/news/topics/${slug}`,
      source: "bloomberg.com",
    },
    {
      title: `${titleCase} — live updates`,
      snippet: `Rolling coverage of ${clean}: newest developments first, verified against multiple outlets.`,
      url: `https://apnews.com/hub/${slug}`,
      source: "apnews.com",
    },
    {
      title: `Explainer: ${clean} in five charts`,
      snippet: `A visual breakdown of ${clean} and the data behind the story.`,
      url: `https://www.ft.com/${slug}`,
      source: "ft.com",
    },
  ];

  const base = TOPIC_SAMPLES.slice(0, 2).map((item) => ({
    title: item.title,
    snippet: item.detail,
    url: item.url,
    source: new URL(item.url).hostname.replace("www.", ""),
  }));

  const results = [...derived, ...base].map((item, index) => ({
    rank: index + 1,
    title: item.title,
    snippet: item.snippet,
    url: item.url,
    source: item.source,
    publishedAt: iso(-index * 95),
    relevance: Number((0.97 - index * 0.06).toFixed(2)),
  }));
  return { topic, results };
}

export function simulateTool(
  actionSlug: string,
  args: Record<string, unknown>,
): SimulatedResult {
  const slug = actionSlug.toUpperCase();

  switch (slug) {
    case "WEB_SEARCH":
    case "SERP_GOOGLE_SEARCH": {
      const query = str(args, "query", "the latest trends");
      const data = researchItems(query);
      return {
        title: `Searched the web for “${query}”`,
        summary: `Found ${data.results.length} fresh results for “${query}”, led by “${data.results[0].title}”.`,
        output: { query, engine: "google", results: data.results },
      };
    }

    case "SERP_GOOGLE_JOBS": {
      const query = str(args, "query", "senior frontend engineer");
      const jobs = [
        { title: "Senior Frontend Engineer (React/Next.js)", company: "Linear", location: "Remote (EU)", salary: "$150k–$190k", url: "https://jobs.linear.app/senior-frontend", postedAt: iso(-180) },
        { title: "Founding Product Engineer", company: "Framer", location: "Remote", salary: "€95k–€130k", url: "https://framer.com/careers/founding-engineer", postedAt: iso(-420) },
        { title: "Frontend Platform Engineer", company: "Vercel", location: "Remote (US/EU)", salary: "$160k–$210k", url: "https://vercel.com/careers/frontend-platform", postedAt: iso(-700) },
        { title: "Full-Stack Engineer — AI Agents", company: "Browserbase", location: "San Francisco / Remote", salary: "$170k–$220k", url: "https://browserbase.com/careers/fullstack", postedAt: iso(-900) },
        { title: "React Engineer, Design Systems", company: "Notion", location: "Remote", salary: "$145k–$185k", url: "https://notion.so/careers/design-systems", postedAt: iso(-1400) },
      ];
      return {
        title: `Searched ${jobs.length} live job boards`,
        summary: `${jobs.length} remote roles found for “${query}”, top match ${jobs[0].company} (${jobs[0].salary}).`,
        output: { query, results: jobs },
      };
    }

    case "REDDIT_GET_TOP_POSTS":
    case "REDDIT_SEARCH_POSTS": {
      const subreddit = str(args, "subreddit", "artificial");
      const posts = SUBREDDIT_POSTS[subreddit] ?? SUBREDDIT_POSTS.artificial;
      const enriched = posts.map((post, index) => ({
        rank: index + 1,
        title: post.title,
        score: post.score,
        comments: post.comments,
        url: `https://reddit.com/r/${subreddit}/comments/${slugify(post.title)}`,
        subreddit: `r/${subreddit}`,
        postedAt: iso(-index * 220),
      }));
      return {
        title: `Pulled top posts from r/${subreddit}`,
        summary: `r/${subreddit} top post: “${posts[0].title}” with ${posts[0].score.toLocaleString()} upvotes in the last 24h.`,
        output: { subreddit, timeFilter: str(args, "time_filter", "day"), posts: enriched },
      };
    }

    case "GMAIL_FETCH_EMAILS":
    case "OUTLOOK_LIST_MESSAGES": {
      const emails = [
        { from: "Priya Sharma <priya@acme.io>", subject: "Q3 launch — final approval needed", snippet: "We need your sign-off on the launch checklist by EOD tomorrow…", labels: ["IMPORTANT"], unread: true, receivedAt: iso(-42) },
        { from: "Stripe <receipts@stripe.com>", subject: "Your invoice is available", snippet: "Invoice #INV-2041 for $249.00 has been paid…", labels: [], unread: true, receivedAt: iso(-120) },
        { from: "GitHub <notifications@github.com>", subject: "[groovy-ai/platform] PR #482 ready for review", snippet: "feat: add scheduled run dispatcher…", labels: ["Updates"], unread: true, receivedAt: iso(-260) },
        { from: "Design team", subject: "New dashboard mockups 🎨", snippet: "Updated the agent cards and run timeline…", labels: [], unread: true, receivedAt: iso(-540) },
        { from: "AWS Billing <aws@amazon.com>", subject: "Your AWS bill increased 18%", snippet: "Your estimated charges for this month are $412.30…", labels: ["Finance"], unread: false, receivedAt: iso(-900) },
        { from: "Maya Chen <maya@vendor.co>", subject: "Re: Partnership proposal", snippet: "Thanks for the detailed deck — our team is aligned…", labels: [], unread: false, receivedAt: iso(-1500) },
        { from: "Calendar <calendar-notification@google.com>", subject: "Invitation: Board sync @ Thu 3:00 PM", snippet: "You have been invited to Board sync…", labels: [], unread: true, receivedAt: iso(-1620) },
        { from: "Newsletter — The Batch", subject: "This week in AI: agents everywhere", snippet: "The biggest stories in AI this week…", labels: ["Newsletters"], unread: false, receivedAt: iso(-1800) },
      ];
      const unread = emails.filter((email) => email.unread);
      const urgent = emails.filter((email) => email.labels.includes("IMPORTANT"));
      return {
        title: `Read ${emails.length} messages (${unread.length} unread)`,
        summary: `${unread.length} unread emails; ${urgent.length} flagged urgent (“${urgent[0]?.subject ?? "none"}”).`,
        output: { account: "me", messages: emails, unreadCount: unread.length, urgentCount: urgent.length },
      };
    }

    case "GMAIL_SEND_EMAIL":
    case "OUTLOOK_SEND_EMAIL": {
      const to = str(args, "to", str(args, "recipient", "me"));
      const subject = str(args, "subject", "Agent result");
      return {
        title: `Sent email to ${to}`,
        summary: `Email “${subject}” delivered to ${to}.`,
        url: `https://mail.google.com/mail/u/0/#sent/${slugify(subject)}`,
        output: {
          messageId: `msg_${Date.now().toString(36)}`,
          threadId: `thr_${Math.random().toString(36).slice(2, 10)}`,
          to,
          subject,
          status: "SENT",
          threadUrl: `https://mail.google.com/mail/u/0/#sent/${slugify(subject)}`,
        },
      };
    }

    case "GMAIL_CREATE_EMAIL_DRAFT": {
      const subject = str(args, "subject", "Draft");
      return {
        title: `Created draft “${subject}”`,
        summary: `Draft saved with subject “${subject}”.`,
        output: { draftId: `draft_${Date.now().toString(36)}`, subject, status: "DRAFT" },
      };
    }

    case "SLACK_SEND_MESSAGE": {
      const channel = str(args, "channel", "#general");
      const text = str(args, "text", "Agent update");
      const ts = `${Math.floor(Date.now() / 1000)}.000100`;
      return {
        title: `Posted to Slack ${channel}`,
        summary: `Slack message delivered to ${channel}.`,
        url: `https://groovy-ai.slack.com/archives/C0AGENT/p${ts.replace(".", "")}`,
        output: {
          ok: true,
          channel,
          ts,
          message: { text },
          permalink: `https://groovy-ai.slack.com/archives/C0AGENT/p${ts.replace(".", "")}`,
        },
      };
    }

    case "SLACK_FETCH_CONVERSATION_HISTORY": {
      const channel = str(args, "channel", "#standup");
      return {
        title: `Read Slack history from ${channel}`,
        summary: `Collected standup updates from ${channel}; 1 blocker mentioned.`,
        output: {
          channel,
          messages: [
            { user: "alen", text: "Yesterday: shipped agent config editor. Today: Inngest dispatcher. No blockers.", ts: iso(-840) },
            { user: "maya", text: "Working on integrations page. Blocker: Composio sandbox keys.", ts: iso(-820) },
            { user: "ravi", text: "Fixed Slack tool timeouts, ready for review.", ts: iso(-790) },
          ],
          blockers: ["Composio sandbox keys pending"],
        },
      };
    }

    case "NOTION_CREATE_PAGE": {
      const title = str(args, "title", "Agent report");
      return {
        title: `Created Notion page “${title}”`,
        summary: `Notion page “${title}” created.`,
        url: `https://www.notion.so/${slugify(title)}-${Math.random().toString(36).slice(2, 10)}`,
        output: {
          pageId: `page_${Math.random().toString(36).slice(2, 12)}`,
          title,
          url: `https://www.notion.so/${slugify(title)}-${Math.random().toString(36).slice(2, 10)}`,
        },
      };
    }

    case "NOTION_QUERY_DATABASE": {
      return {
        title: "Queried Notion database",
        summary: "Returned 4 matching records from the connected Notion database.",
        output: {
          results: [
            { title: "Q3 roadmap", status: "In progress", owner: "Priya" },
            { title: "Pricing refresh", status: "Review", owner: "Maya" },
            { title: "Agent launch checklist", status: "Todo", owner: "Ravi" },
            { title: "Competitor teardown", status: "Done", owner: "Alen" },
          ],
        },
      };
    }

    case "GOOGLEDOCS_CREATE_DOCUMENT": {
      const title = str(args, "title", "Agent report");
      const id = `1${Math.random().toString(36).slice(2, 14)}`;
      return {
        title: `Created Google Doc “${title}”`,
        summary: `Google Doc “${title}” created with the full report.`,
        url: `https://docs.google.com/document/d/${id}/edit`,
        output: {
          documentId: id,
          title,
          url: `https://docs.google.com/document/d/${id}/edit`,
          revisionId: `rev_${Math.random().toString(36).slice(2, 8)}`,
        },
      };
    }

    case "GOOGLEDOCS_APPEND_TEXT": {
      return {
        title: "Appended content to the document",
        summary: "Report content appended to the Google Doc.",
        output: { documentId: str(args, "documentId", "agent-doc"), appendedCharacters: 1840, status: "OK" },
      };
    }

    case "GOOGLEDRIVE_UPLOAD_FILE": {
      return {
        title: "Uploaded file to Google Drive",
        summary: "File uploaded to Drive folder /Agents.",
        url: "https://drive.google.com/file/d/agent-report/view",
        output: { fileId: `file_${Math.random().toString(36).slice(2, 10)}`, name: str(args, "name", "agent-report.md"), url: "https://drive.google.com/file/d/agent-report/view" },
      };
    }

    case "GOOGLEDRIVE_FIND_FILE": {
      return {
        title: "Searched Google Drive",
        summary: "Found 3 matching files in Drive.",
        output: { files: [{ id: "file_1", name: "Q3 plan.docx" }, { id: "file_2", name: "metrics.xlsx" }, { id: "file_3", name: "agent-report.md" }] },
      };
    }

    case "GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND": {
      return {
        title: "Appended rows to Google Sheets",
        summary: "5 result rows appended to the tracking spreadsheet.",
        output: { spreadsheetId: str(args, "spreadsheetId", "agent-results"), updatedRange: "Sheet1!A2:D6", updatedRows: 5 },
      };
    }

    case "GOOGLESHEETS_GET_SPREADSHEET_VALUES": {
      return {
        title: "Read Google Sheets values",
        summary: "Loaded 5 rows from the spreadsheet.",
        output: { range: str(args, "range", "Sheet1!A1:D5"), values: [["date", "title", "score"], ["2026-09-09", "Agent observability", "94"]] },
      };
    }

    case "GITHUB_LIST_PULL_REQUESTS": {
      const repo = str(args, "repository", "groovy-ai/platform");
      return {
        title: `Reviewed pull requests in ${repo}`,
        summary: `Found 3 open PRs in ${repo}; 1 is awaiting your review.`,
        output: {
          repository: repo,
          pullRequests: [
            { number: 482, title: "feat: scheduled run dispatcher", author: "alen", reviewRequested: true, checks: "passing", updatedAt: iso(-90), url: `https://github.com/${repo}/pull/482` },
            { number: 479, title: "fix: composio session reuse", author: "maya", reviewRequested: false, checks: "passing", updatedAt: iso(-380), url: `https://github.com/${repo}/pull/479` },
            { number: 471, title: "chore: bump browserbase sdk", author: "ravi", reviewRequested: false, checks: "failing", updatedAt: iso(-900), url: `https://github.com/${repo}/pull/471` },
          ],
        },
      };
    }

    case "GITHUB_CREATE_ISSUE": {
      const title = str(args, "title", "Agent report");
      return {
        title: `Created issue “${title}”`,
        summary: `GitHub issue “${title}” created.`,
        url: `https://github.com/groovy-ai/platform/issues/${Math.floor(Math.random() * 900) + 100}`,
        output: { number: Math.floor(Math.random() * 900) + 100, title, state: "open", url: `https://github.com/groovy-ai/platform/issues/500` },
      };
    }

    case "GITHUB_GET_REPOSITORY": {
      return {
        title: "Fetched repository details",
        summary: "Repository metadata loaded (1.2k stars, 34 open issues).",
        output: { fullName: "groovy-ai/platform", stars: 1240, openIssues: 34, defaultBranch: "main", language: "TypeScript" },
      };
    }

    case "GOOGLECALENDAR_LIST_EVENTS": {
      const events = [
        { title: "Board sync", start: iso(180), end: iso(240), attendees: 6, location: "Google Meet", link: "https://meet.google.com/abc-defg-hij" },
        { title: "Deep work — agent platform", start: iso(300), end: iso(480), attendees: 0, location: "Focus block" },
        { title: "1:1 with Maya", start: iso(540), end: iso(570), attendees: 2, location: "Zoom" },
        { title: "Product review", start: iso(1560), end: iso(1620), attendees: 8, location: "Google Meet" },
      ];
      return {
        title: "Loaded 4 upcoming calendar events",
        summary: `${events.length} events loaded; first is “${events[0].title}” at ${new Date(events[0].start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
        output: { calendar: "primary", events },
      };
    }

    case "GOOGLECALENDAR_CREATE_EVENT": {
      const summary = str(args, "summary", "Focus block");
      return {
        title: `Created calendar event “${summary}”`,
        summary: `Event “${summary}” added to your calendar.`,
        url: "https://calendar.google.com/calendar/event?eid=agent",
        output: { eventId: `evt_${Math.random().toString(36).slice(2, 10)}`, summary, status: "confirmed", htmlLink: "https://calendar.google.com/calendar/event?eid=agent" },
      };
    }

    case "DISCORD_SEND_MESSAGE": {
      return {
        title: "Posted to Discord",
        summary: `Message delivered to Discord channel ${str(args, "channel", "agent-updates")}.`,
        url: "https://discord.com/channels/@me/agent-updates",
        output: { id: `msg_${Date.now().toString(36)}`, channel: str(args, "channel", "agent-updates"), url: "https://discord.com/channels/@me/agent-updates" },
      };
    }

    case "TELEGRAM_SEND_MESSAGE": {
      return {
        title: "Sent Telegram message",
        summary: "Telegram notification simulated — connect Telegram to send for real.",
        output: { messageId: Date.now(), chat: str(args, "chatId", "me"), status: "simulated" },
      };
    }

    case "TWITTER_CREATE_TWEET": {
      const text = str(args, "text", "Update from my AI agent");
      return {
        title: "Published post on X",
        summary: `Post published: “${text.slice(0, 60)}…”`,
        url: "https://x.com/groovy_ai/status/1800000000000000000",
        output: { id: "1800000000000000000", text, url: "https://x.com/groovy_ai/status/1800000000000000000" },
      };
    }

    case "LINEAR_CREATE_ISSUE":
    case "JIRA_CREATE_ISSUE": {
      const title = str(args, "title", "Follow up from agent run");
      return {
        title: `Created issue “${title}”`,
        summary: `Issue “${title}” created and assigned.`,
        url: "https://linear.app/groovy/issue/GRO-512",
        output: { id: "GRO-512", title, state: "Todo", url: "https://linear.app/groovy/issue/GRO-512" },
      };
    }

    case "LINEAR_LIST_ISSUES": {
      return {
        title: "Listed Linear issues",
        summary: "4 in-progress issues loaded; 1 is blocked.",
        output: { issues: [{ id: "GRO-498", title: "Agent run timeline", state: "In Progress" }, { id: "GRO-501", title: "Composio retries", state: "Blocked" }] },
      };
    }

    case "TRELLO_CREATE_CARD": {
      return {
        title: "Created Trello card",
        summary: "Card added to the Agent Results board.",
        output: { id: `card_${Date.now().toString(36)}`, board: "Agent Results", status: "open" },
      };
    }

    case "ASANA_CREATE_TASK": {
      return {
        title: "Created Asana task",
        summary: "Task created in the Operations project.",
        output: { gid: `task_${Date.now().toString(36)}`, name: str(args, "name", "Agent follow-up"), status: "created" },
      };
    }

    case "AIRTABLE_CREATE_RECORD": {
      return {
        title: "Created Airtable record",
        summary: "Record added to the Agents base.",
        output: { id: `rec_${Date.now().toString(36)}`, base: "Agents", created: true },
      };
    }

    case "HUBSPOT_CREATE_CONTACT":
    case "SALESFORCE_QUERY": {
      return {
        title: "Updated CRM",
        summary: "CRM query completed; 3 leads matched.",
        output: { records: 3, topLead: { name: "Acme Corp", score: 87 } },
      };
    }

    case "STRIPE_LIST_PAYMENTS": {
      return {
        title: "Loaded Stripe payments",
        summary: "3 recent payments totalling $1,284 loaded.",
        output: { payments: [{ amount: 249, currency: "usd", status: "succeeded" }, { amount: 786, currency: "usd", status: "succeeded" }, { amount: 249, currency: "usd", status: "refunded" }] },
      };
    }

    case "SHOPIFY_LIST_ORDERS": {
      return {
        title: "Loaded Shopify orders",
        summary: "5 orders from the last 24 hours loaded (2 unfulfilled).",
        output: { orders: 5, unfulfilled: 2, revenue: 1284.5 },
      };
    }

    case "YOUTUBE_SEARCH_VIDEOS": {
      return {
        title: "Searched YouTube",
        summary: "4 relevant videos found.",
        output: { videos: [{ title: "Build an AI agent platform", channel: "TubeGuruji", views: 32000 }, { title: "Browser agents explained", channel: "AI Explained", views: 98000 }] },
      };
    }

    case "CALENDLY_LIST_EVENTS": {
      return {
        title: "Loaded Calendly events",
        summary: "2 meetings booked today.",
        output: { events: [{ name: "Intro call", start: iso(420) }, { name: "Demo — Acme", start: iso(1200) }] },
      };
    }

    case "ZOOM_CREATE_MEETING": {
      return {
        title: "Created Zoom meeting",
        summary: "Zoom meeting scheduled.",
        url: "https://zoom.us/j/9876543210",
        output: { id: 9876543210, joinUrl: "https://zoom.us/j/9876543210" },
      };
    }

    default: {
      const tool = actionSlug.split("_")[0];
      const catalogTool = toolBySlug.get(tool.toLowerCase());
      return {
        title: `${catalogTool?.name ?? actionSlug} action completed`,
        summary: `${catalogTool?.name ?? actionSlug} executed successfully (simulated).`,
        output: {
          status: "success",
          action: actionSlug,
          tool: catalogTool?.slug ?? actionSlug.toLowerCase(),
          executedAt: iso(),
          parameters: args,
        },
      };
    }
  }
}
