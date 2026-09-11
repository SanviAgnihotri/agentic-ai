import { CLARIFICATION_ANSWER_HEADER } from "@/agent/config/prompts";
import type { AgentConfigAiResponse, ClarificationQuestion, GeneratedAgentConfig } from "@/agent/config/response-schema";
import { toolBySlug } from "@/agent/tools/catalog";
import type {
  ChatMessage,
  LlmChatResult,
  MockContext,
} from "./types";

/**
 * Offline mock provider.
 *
 * It is a deterministic planner that reads the same prompts as a real LLM and
 * returns schema-shaped responses, so the whole platform (config generation,
 * clarification, execution, chat, briefing) is fully usable with no API keys.
 * It is also the seed of a good demo: the simulated tools return realistic data.
 */

const TOOL_PATTERNS: Array<[RegExp, string]> = [
  [/\bgmail\b|inbox|unread|e-?mail/i, "gmail"],
  [/\boutlook\b/i, "outlook"],
  [/\bslack\b/i, "slack"],
  [/\breddit\b/i, "reddit"],
  [/google\s?docs?|gdocs/i, "googledocs"],
  [/google\s?sheets?|spreadsheet/i, "googlesheets"],
  [/google\s?calendar|gcal/i, "googlecalendar"],
  [/\bcalendly\b/i, "calendly"],
  [/\bnotion\b/i, "notion"],
  [/\bgithub\b|pull request|\brepo\b/i, "github"],
  [/\bdiscord\b/i, "discord"],
  [/\btelegram\b/i, "telegram"],
  [/\btwitter\b|\bx\.com\b|tweet/i, "twitter"],
  [/\bjira\b/i, "jira"],
  [/\blinear\b/i, "linear"],
  [/\btrello\b/i, "trello"],
  [/\basana\b/i, "asana"],
  [/\bhubspot\b/i, "hubspot"],
  [/\bairtable\b/i, "airtable"],
  [/\bstripe\b/i, "stripe"],
  [/\bshopify\b/i, "shopify"],
  [/\bdropbox\b/i, "dropbox"],
  [/\byoutube\b/i, "youtube"],
  [/\bzoom\b/i, "zoom"],
];

const ANSWER_TO_TOOL: Array<[RegExp, string]> = [
  [/google\s?calendar/i, "googlecalendar"],
  [/outlook/i, "outlook"],
  [/notion/i, "notion"],
  [/google\s?docs?/i, "googledocs"],
  [/google\s?sheets?/i, "googlesheets"],
  [/airtable/i, "airtable"],
  [/slack/i, "slack"],
  [/discord/i, "discord"],
  [/telegram/i, "telegram"],
  [/gmail/i, "gmail"],
  [/e-?mail/i, "gmail"],
  [/github/i, "github"],
  [/reddit/i, "reddit"],
];

export function detectTools(text: string): string[] {
  const found = new Set<string>();
  for (const [pattern, slug] of TOOL_PATTERNS) {
    if (pattern.test(text)) found.add(slug);
  }
  if (
    /search|research|find|news|trend|monitor|competitor|price|job|report|study|latest/i.test(
      text,
    ) &&
    found.size === 0
  ) {
    found.add("web_search");
  }
  if (/browse|website|pricing page|scrape|live site|visit/i.test(text)) {
    found.add("browserbase");
  }
  if (found.size === 0) found.add("web_search");
  return Array.from(found).filter((slug) => toolBySlug.has(slug));
}

interface ParsedSchedule {
  type: "manual" | "once" | "recurring";
  time: string;
  frequency?: "hourly" | "daily" | "weekly" | "monthly" | null;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  date?: string | null;
}

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function parseSchedule(text: string): ParsedSchedule {
  const lower = text.toLowerCase();
  const schedule: ParsedSchedule = { type: "recurring", time: "09:00", frequency: "daily" };

  if (/manual|on demand|only when i ask|when i say/i.test(lower)) {
    schedule.type = "manual";
    schedule.frequency = null;
  }

  const dayMatch = WEEKDAYS.findIndex((day) => lower.includes(`every ${day}`));
  if (dayMatch !== -1) {
    schedule.frequency = "weekly";
    schedule.dayOfWeek = dayMatch;
  } else if (/every week|weekly|each week/i.test(lower)) {
    schedule.frequency = "weekly";
    schedule.dayOfWeek = 1;
  }
  if (/every month|monthly/i.test(lower)) {
    schedule.frequency = "monthly";
    schedule.dayOfMonth = 1;
  }
  if (/every hour|hourly|each hour/i.test(lower)) {
    schedule.frequency = "hourly";
  }
  if (/weekdays|every weekday|mon(day)?\s*(-|to)\s*fri(day)?/i.test(lower)) {
    schedule.frequency = "daily";
  }

  const once = lower.match(/\bon (\d{4}-\d{2}-\d{2})\b/);
  if (once) {
    schedule.type = "once";
    schedule.date = once[1];
  } else if (/\b(tomorrow|today)\b/.test(lower) && !/every|daily|weekly/i.test(lower)) {
    schedule.type = "once";
    const d = new Date();
    if (lower.includes("tomorrow")) d.setDate(d.getDate() + 1);
    schedule.date = d.toISOString().slice(0, 10);
  }

  const time12 = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  const time24 = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (time12) {
    let hour = parseInt(time12[1], 10) % 12;
    if (time12[3] === "pm") hour += 12;
    schedule.time = `${String(hour).padStart(2, "0")}:${time12[2] ?? "00"}`;
  } else if (time24) {
    schedule.time = `${String(parseInt(time24[1], 10)).padStart(2, "0")}:${time24[2]}`;
  }

  return schedule;
}

function deriveName(prompt: string, tools: string[]): string {
  const lower = prompt.toLowerCase();
  const patterns: Array<[RegExp, string]> = [
    [/reddit.*(trend|top)|(trend|top).*reddit/, "Reddit Trend Radar"],
    [/inbox|unread|email summar|summar.*(email|mail)/, "Inbox Zero Digest"],
    [/job|hiring|vacanc|career/, "Job Scout"],
    [/meeting|calendar|schedule.*(day|tomorrow)/, "Meeting Planner"],
    [/competitor|pricing page|price (watch|track|monitor)/, "Price Watcher"],
    [/github|pull request|release|repo/, "Repo Pulse"],
    [/notion|note/, "Note Curator"],
    [/slack.*(standup|update)|standup/, "Standup Collector"],
    [/news|article|industry|research/, "Research Radar"],
    [/report|digest|brief|summary|summar/, "Daily Briefing Bot"],
  ];
  for (const [pattern, name] of patterns) {
    if (pattern.test(lower)) return name;
  }
  if (tools.includes("browserbase")) return "Web Scout Agent";
  const words = prompt
    .replace(/[^a-zA-Z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["every", "daily", "please", "then", "with", "that", "this"].includes(w.toLowerCase()))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  return words.length ? `${words.join(" ")} Agent` : "Task Runner";
}

function buildConfig(
  prompt: string,
  availableToolSlugs?: string[],
  connected: Set<string> = new Set(),
): GeneratedAgentConfig {
  const available = availableToolSlugs?.length ? new Set(availableToolSlugs) : null;
  const tools = detectTools(prompt).filter(
    (slug) => toolBySlug.has(slug) && (!available || available.has(slug)),
  );
  if (tools.length === 0) tools.push("web_search");

  // Prefer already-connected integrations for vague write/notify intents so the
  // agent can act immediately without asking the user to connect anything.
  const wantsWrite = /save|write|store|report|document|\bdocs?\b|note/i.test(prompt);
  const wantsNotify = /notify|send|alert|message|post/i.test(prompt);
  const writeTools = ["googledocs", "notion", "googlesheets", "airtable"];
  const notifyTools = ["slack", "telegram", "discord", "gmail", "outlook"];
  if (wantsWrite && !tools.some((slug) => writeTools.includes(slug))) {
    const pick = writeTools.find((slug) => connected.has(slug));
    if (pick) tools.push(pick);
  }
  if (wantsNotify && !tools.some((slug) => notifyTools.includes(slug))) {
    const pick = notifyTools.find((slug) => connected.has(slug));
    if (pick) tools.push(pick);
  }

  const schedule = parseSchedule(prompt);
  const name = deriveName(prompt, tools);
  const lower = prompt.toLowerCase();

  const read = tools.filter((t) =>
    ["gmail", "outlook", "reddit", "web_search", "serpapi", "browserbase", "github", "googlecalendar"].includes(t),
  );
  const write = tools.filter((t) => ["googledocs", "notion", "googlesheets", "airtable"].includes(t));
  const notify = tools.filter((t) =>
    ["slack", "discord", "telegram", "gmail", "outlook", "twitter"].includes(t),
  );

  const description = `${name} autonomously runs your recurring task on autopilot: ${lower
    .replace(/\bevery (day|week|month|hour)\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 110)}`;

  const objective = `Deliver a high-quality, up-to-date result for the user's goal${
    schedule.type === "recurring"
      ? ` on a ${schedule.frequency ?? "daily"} schedule at ${schedule.time} local time`
      : schedule.type === "once"
        ? ` on ${schedule.date}`
        : " on demand"
  }.`;

  const steps: string[] = [];
  steps.push(`Review the agent objective and confirm the exact deliverable before acting.`);
  if (read.length) {
    steps.push(
      `Gather the latest data using ${read.map((t) => toolBySlug.get(t)?.name ?? t).join(", ")}. Prefer the last 24 hours and collect at least 5 concrete items with source links.`,
    );
  }
  steps.push(
    `Filter out duplicates and low-signal items, then rank by relevance to the objective.`,
  );
  if (write.length) {
    steps.push(
      `Write the structured report (executive summary + ranked list + links) into ${write
        .map((t) => toolBySlug.get(t)?.name ?? t)
        .join(", ")}.`,
    );
  } else {
    steps.push(`Compose the structured report (executive summary + ranked list + links).`);
  }
  if (notify.length) {
    steps.push(
      `Notify the user via ${notify.map((t) => toolBySlug.get(t)?.name ?? t).join(", ")} with a short digest and a link to the full report.`,
    );
  }
  steps.push(
    `If a tool fails, retry once with different parameters, continue with the remaining steps and note the failure in the final report.`,
  );

  const skills = Array.from(
    new Set([
      "Web research",
      tools.includes("browserbase") ? "Browser automation" : "Data extraction",
      "Summarization",
      notify.length ? "Notifications" : "Reporting",
      write.length ? "Document automation" : "Analysis",
    ]),
  ).slice(0, 5);

  return {
    name,
    description: description.charAt(0).toUpperCase() + description.slice(1),
    objective,
    instructions: steps.map((step, i) => `${i + 1}. ${step}`).join("\n"),
    tools,
    skills,
    schedule,
    outputFormat:
      "Markdown report with a one-paragraph executive summary, a ranked list of findings (title, why it matters, link) and a short notes section.",
  };
}

function buildQuestions(
  prompt: string,
  connected: Set<string> = new Set(),
): ClarificationQuestion[] {
  const lower = prompt.toLowerCase();
  const hasCalendar = /google\s?calendar|outlook/i.test(lower);
  const hasDocs = /google\s?docs?|notion|airtable/i.test(lower);
  const hasMail = /gmail|outlook/i.test(lower);
  const questions: ClarificationQuestion[] = [];

  // Never ask about a service the user already has connected — use it directly.
  const calendarConnected = connected.has("googlecalendar") || connected.has("outlook");
  const docsConnected =
    connected.has("googledocs") || connected.has("notion") || connected.has("airtable");
  const mailConnected = connected.has("gmail") || connected.has("outlook");

  if (/calendar|meeting|schedule/i.test(lower) && !hasCalendar && !calendarConnected) {
    questions.push({
      id: "calendar_service",
      question: "Which calendar service do you use?",
      type: "select",
      options: ["Google Calendar", "Outlook Calendar"],
      allowCustom: true,
      customPlaceholder: "Type another service",
    });
  }
  if (
    /docs?|documents?|notes?|report/i.test(lower) &&
    !hasDocs &&
    !docsConnected
  ) {
    questions.push({
      id: "result_destination",
      question: "Where should the results be saved?",
      type: "select",
      options: ["Google Docs", "Notion", "Airtable"],
      allowCustom: true,
      customPlaceholder: "Type another destination",
    });
  }
  if (/e-?mails?|inbox|mail/i.test(lower) && !hasMail && !mailConnected) {
    questions.push({
      id: "mail_provider",
      question: "Which email provider should the agent use?",
      type: "select",
      options: ["Gmail", "Outlook"],
      allowCustom: false,
      customPlaceholder: "",
    });
  }
  if (questions.length === 0 && prompt.trim().split(/\s+/).length < 7) {
    questions.push({
      id: "run_frequency",
      question: "How often should this agent run?",
      type: "select",
      options: ["Every day at 8:00", "Every Monday at 9:00", "Only when I ask"],
      allowCustom: true,
      customPlaceholder: "e.g. every weekday at 7:30",
    });
  }
  return questions.slice(0, 3);
}

export function mockAgentConfig(options: {
  prompt: string;
  toolSlugs: string[];
  connectedToolSlugs?: string[];
}): AgentConfigAiResponse {
  const { prompt, toolSlugs } = options;
  const connected = new Set(options.connectedToolSlugs ?? []);
  const answersIndex = prompt.indexOf(CLARIFICATION_ANSWER_HEADER);
  const alreadyClarified = answersIndex !== -1;

  let enrichedPrompt = prompt;
  if (alreadyClarified) {
    const answersJson = prompt.slice(answersIndex + CLARIFICATION_ANSWER_HEADER.length);
    try {
      const answers = JSON.parse(answersJson) as Record<string, string>;
      const additions: string[] = [];
      for (const value of Object.values(answers)) {
        for (const [pattern, slug] of ANSWER_TO_TOOL) {
          if (pattern.test(String(value))) additions.push(slug);
        }
        additions.push(String(value));
      }
      enrichedPrompt = `${prompt.slice(0, answersIndex)} ${additions.join(" ")}`;
    } catch {
      enrichedPrompt = prompt;
    }
  }

  if (!alreadyClarified) {
    const questions = buildQuestions(enrichedPrompt, connected);
    if (questions.length > 0) {
      return { status: "needs_clarification", clarificationQuestions: questions };
    }
  }

  return {
    status: "ready",
    config: buildConfig(enrichedPrompt, toolSlugs, connected),
  };
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

function agentOf(context: MockContext): Record<string, unknown> {
  return (context.agent ?? {}) as Record<string, unknown>;
}

function runsOf(context: MockContext): Array<Record<string, unknown>> {
  return (context.runs ?? []) as Array<Record<string, unknown>>;
}

export function mockChatAnswer(context: MockContext): string {
  const agent = agentOf(context);
  const runs = runsOf(context);
  const question = (context.userMessage ?? "").toLowerCase();
  const name = String(agent.name ?? "this agent");
  const tools = ((agent.tools as string[]) ?? []).map((t) => toolBySlug.get(t)?.name ?? t);
  const lastRun = runs[0];
  const lastOutput = lastRun ? String(lastRun.output ?? "") : "";

  if (/what can you do|who are you|help|capabilit/.test(question)) {
    return `Hi! I'm **${name}**.\n\n${
      agent.description ?? ""
    }\n\n**What I can do**\n- Objective: ${agent.objective ?? "complete my configured task"}\n- Skills: ${((agent.skills as string[]) ?? []).join(", ") || "general automation"}\n- Tools I can use: ${tools.join(", ") || "built-in web tools"}\n${
      Array.isArray(agent.schedule) ? "" : ""
    }\nAsk me for your latest result, or hit **Run now** if you want me to execute immediately.`;
  }

  if (/slack|notif/.test(question)) {
    const notified = lastOutput.toLowerCase().includes("slack");
    return notified
      ? `Yes — the last run sent a Slack digest to your connected channel. It included a short summary and a link to the full report.`
      : `I haven't sent any Slack notifications yet. The next run will notify you after it finishes${
          lastRun ? "" : " — or trigger **Run now** to test it immediately."
        }`;
  }

  if (/google ?doc|document|report|summary|summar/.test(question)) {
    const link = lastOutput.match(/https?:\/\/\S+/)?.[0];
    if (lastRun && lastOutput) {
      return `Here's the latest result from **${new Date(
        String(lastRun.createdAt ?? Date.now()),
      ).toLocaleString()}**:\n\n${lastOutput.slice(0, 600)}${
        link ? `\n\n[Open the full document](${link})` : ""
      }`;
    }
    return `I don't have a completed run yet. Run me once and I'll save the full report to your connected docs tool.`;
  }

  if (/next run|when|schedule/.test(question)) {
    const schedule = agent.schedule as Record<string, unknown> | undefined;
    if (!schedule || schedule.type === "manual") {
      return `I'm set to run **on demand only** right now. You can change the schedule from the agent configuration.`;
    }
    return `I'm scheduled **${schedule.type === "recurring" ? schedule.frequency : schedule.type}** at **${schedule.time}** (${schedule.timeZone ?? "UTC"}). You can pause me anytime from My Agents.`;
  }

  if (/hi|hello|hey\b/.test(question)) {
    return `Hey! I'm ${name}. ${agent.description ?? ""}\n\nI've completed **${runs.length}** run${runs.length === 1 ? "" : "s"} so far. Want the latest result?`;
  }

  if (lastRun && lastOutput && question.length > 2) {
    return `Here's what I know from my most recent run (${new Date(
      String(lastRun.createdAt ?? Date.now()),
    ).toLocaleString()}):\n\n${lastOutput.slice(0, 700)}\n\nIs there anything specific you'd like me to dig into on the next run?`;
  }

  return `I'm **${name}** — ${agent.description ?? "your autonomous agent"}. I don't have a completed run to summarize yet. Ask "what can you do", check my schedule, or hit **Run now** and I'll get to work.`;
}

/* ------------------------------------------------------------------ */
/* Execution plan + simulated tool selection                           */
/* ------------------------------------------------------------------ */

interface PlannedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export function buildToolPlan(
  agent: Record<string, unknown>,
  input: string,
): PlannedToolCall[] {
  const tools = ((agent.tools as string[]) ?? []).filter((t) => toolBySlug.has(t));
  const objective = String(agent.objective ?? "");
  const context = `${objective} ${input}`.toLowerCase();
  const plan: PlannedToolCall[] = [];
  const push = (call: PlannedToolCall) => {
    if (!plan.some((p) => p.name === call.name)) plan.push(call);
  };

  const topic =
    objective.match(/(?:about|on|for)\s+([a-z0-9 ]{3,40})/i)?.[1]?.trim() ??
    "the configured topic";

  if (tools.includes("reddit")) {
    const subreddit = context.match(/r\/([a-z0-9_]+)/)?.[1];
    push({
      name: "REDDIT_GET_TOP_POSTS",
      arguments: {
        subreddit: subreddit ?? (/ai|artificial intelligence/.test(context) ? "artificial" : "technology"),
        time_filter: "day",
        limit: 5,
      },
    });
  }
  if (tools.includes("github")) {
    push({
      name: "GITHUB_LIST_PULL_REQUESTS",
      arguments: { repository: "groovy-ai/platform", state: "open", limit: 10 },
    });
  }
  if (tools.includes("googlecalendar")) {
    push({
      name: "GOOGLECALENDAR_LIST_EVENTS",
      arguments: { calendarId: "primary", timeMin: new Date().toISOString(), maxResults: 10 },
    });
  }
  if (tools.includes("gmail") || tools.includes("outlook")) {
    const send = /send|notify|reply|alert|email me/i.test(context) && !/read|summar|inbox|unread/i.test(context);
    if (send) {
      push({
        name: tools.includes("gmail") ? "GMAIL_SEND_EMAIL" : "OUTLOOK_SEND_EMAIL",
        arguments: {
          to: "me",
          subject: `[${String(agent.name ?? "Agent")}] result is ready`,
          body: "Your agent finished its run. Full report attached below.",
        },
      });
    } else {
      push({
        name: tools.includes("gmail") ? "GMAIL_FETCH_EMAILS" : "OUTLOOK_LIST_MESSAGES",
        arguments: { query: "is:unread", maxResults: 10 },
      });
    }
  }
  if (tools.includes("web_search")) {
    push({
      name: "WEB_SEARCH",
      arguments: { query: `${topic} latest news`, recency: "24h", limit: 6 },
    });
  }
  if (tools.includes("serpapi")) {
    push({
      name: "SERP_GOOGLE_SEARCH",
      arguments: { query: `${topic} trends`, limit: 6 },
    });
  }
  if (tools.includes("browserbase")) {
    const site = context.match(/https?:\/\/([a-z0-9.-]+)/)?.[1];
    push({
      name: "BROWSER_RESEARCH",
      arguments: {
        task: `Visit ${site ?? "the target website"}, extract the current pricing plans and any recent changes for ${topic}, and return a structured summary with exact numbers, plan names and a link.`,
      },
    });
  }

  if (tools.includes("googledocs")) {
    push({
      name: "GOOGLEDOCS_CREATE_DOCUMENT",
      arguments: {
        title: `${String(agent.name ?? "Agent")} — ${new Date().toISOString().slice(0, 10)}`,
        content: "(the generated report is inserted by the agent)",
      },
    });
  }
  if (tools.includes("notion")) {
    push({
      name: "NOTION_CREATE_PAGE",
      arguments: {
        title: `${String(agent.name ?? "Agent")} — ${new Date().toISOString().slice(0, 10)}`,
        content: "(the generated report is inserted by the agent)",
      },
    });
  }
  if (tools.includes("googlesheets")) {
    push({
      name: "GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND",
      arguments: { spreadsheetId: "agent-results", range: "Sheet1!A:D", values: [["date", "title", "link", "score"]] },
    });
  }

  const notifier = tools.find((t) => ["slack", "discord", "telegram"].includes(t));
  if (notifier) {
    const name =
      notifier === "slack"
        ? "SLACK_SEND_MESSAGE"
        : notifier === "discord"
          ? "DISCORD_SEND_MESSAGE"
          : "TELEGRAM_SEND_MESSAGE";
    push({
      name,
      arguments: {
        channel: notifier === "slack" ? "#general" : "agent-updates",
        text: `✅ ${String(agent.name ?? "Agent")} finished its run. Digest and link to the full report included.`,
      },
    });
  }
  if (tools.includes("twitter")) {
    push({
      name: "TWITTER_CREATE_TWEET",
      arguments: { text: `Latest ${topic} update from my Groovy AI agent 🧵` },
    });
  }

  return plan;
}

export function mockToolDecision(
  context: MockContext,
  messages: ChatMessage[],
): LlmChatResult {
  const agent = agentOf(context);
  const input = String(context.input ?? context.prompt ?? "");

  // In chat mode, answer conversationally unless the user asks for an action.
  if (context.kind === "chat" && isConversational(input)) {
    return {
      type: "text",
      text: mockChatAnswer({
        ...context,
        agent,
        userMessage: input,
        runs: runsOf(context),
      }),
    };
  }

  const plan = buildToolPlan(agent, input);
  const executed = context.executedTools ?? [];
  const next = plan.find((call) => !executed.includes(call.name));

  if (next) {
    return {
      type: "tool_calls",
      calls: [
        {
          id: `mock-${next.name}-${executed.length + 1}`,
          name: next.name,
          arguments: next.arguments,
        },
      ],
    };
  }

  return { type: "text", text: mockFinalReport(agent, messages) };
}

function mockFinalReport(agent: Record<string, unknown>, messages: ChatMessage[]): string {
  const toolResults = messages.filter((m) => m.role === "tool");
  const name = String(agent.name ?? "Agent");
  const objective = String(agent.objective ?? "Complete the configured task");
  const lines: string[] = [];

  lines.push(`# ${name} — run report`);
  lines.push(`**Objective:** ${objective}`);
  lines.push("");

  // Collect anything interesting from the simulated tool results.
  const artifacts: Array<{ label: string; value: string }> = [];
  for (const message of toolResults) {
    try {
      const parsed = JSON.parse(message.content) as Record<string, unknown>;
      const label = String(parsed.__label ?? message.name ?? "Tool");
      const artifact =
        parsed.url ?? parsed.link ?? parsed.documentUrl ?? parsed.threadUrl ?? null;
      if (artifact) artifacts.push({ label, value: String(artifact) });
    } catch {
      // ignore malformed simulated output
    }
  }

  lines.push("## Overview");
  lines.push(
    `The agent completed its run using ${toolResults.length} tool call${toolResults.length === 1 ? "" : "s"}. All requested steps finished successfully and the deliverable is ready.`,
  );
  lines.push("");

  lines.push("## Key findings");
  const findings = toolResults
    .map((message) => {
      try {
        const parsed = JSON.parse(message.content) as Record<string, unknown>;
        return parsed.__summary ? String(parsed.__summary) : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .slice(0, 5);
  if (findings.length) {
    for (const finding of findings) lines.push(`- ${finding}`);
  } else {
    lines.push("- The run produced a structured deliverable based on the latest available data.");
  }
  lines.push("");

  lines.push("## Actions taken");
  for (const message of toolResults) {
    lines.push(`- ${message.name ?? "tool"} — completed`);
  }
  lines.push("");

  if (artifacts.length) {
    lines.push("## Artifacts");
    for (const artifact of artifacts) {
      lines.push(`- **${artifact.label}:** ${artifact.value}`);
    }
    lines.push("");
  }

  lines.push("> Generated in demo mode by the built-in Groovy simulation engine. Add an OpenAI or Gemini key to run this agent with live models and tools.");
  return lines.join("\n");
}

function isConversational(input: string): boolean {
  const lower = input.toLowerCase().trim();
  if (!lower) return false;
  const asksAction =
    /\b(find|search|fetch|browse|visit|send|post|write|create|summari[sz]e|monitor|compare|look ?up|execute|run it|run now|do it|go ahead|check (now|the)|get the|pull)\b/.test(
      lower,
    );
  const asksQuestion =
    /\b(what|when|where|why|who|how|did you|have you|are you|can you|tell me|show me|status|latest|last run|result|report|schedule|summary|notification)\b/.test(
      lower,
    );
  if (asksQuestion && !asksAction) return true;
  if (!asksAction && lower.split(/\s+/).length <= 5) return true;
  return false;
}

export function mockBriefing(context: MockContext): string {
  const stats = (context.stats ?? {}) as Record<string, number>;
  const completed = stats.completed ?? 0;
  const failed = stats.failed ?? 0;
  const scheduled = stats.scheduled ?? 0;
  const agents = stats.agents ?? 0;

  return [
    `Your workspace is healthy — **${completed}** run${completed === 1 ? "" : "s"} completed${
      failed ? `, **${failed}** need attention` : " with no failures"
    }, and **${scheduled}** run${scheduled === 1 ? "" : "s"} scheduled ahead.`,
    "",
    `- ${agents} active agent${agents === 1 ? "" : "s"} are working for you.`,
    failed
      ? `- ${failed} recent run${failed === 1 ? "" : "s"} failed — open Runs to see the exact tool error.`
      : `- All recent runs finished successfully.`,
    scheduled ? `- Next scheduled execution is coming up automatically.` : `- No upcoming runs are scheduled — create a schedule for your agents to work while you sleep.`,
    "",
    `**Recommended:** ${
      failed
        ? "review the failed runs and reconnect any expired integration."
        : "create a new agent for a task you repeat every week."
    }`,
  ].join("\n");
}
