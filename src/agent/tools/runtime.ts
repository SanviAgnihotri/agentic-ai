import { z } from "zod";
import type { BrowserResearchResult } from "@/agent/browser";
import { browserResearch, browserSearch } from "@/agent/browser";
import {
  getComposioAgentTools,
  integrationMode,
  listConnections,
} from "@/agent/integrations";
import { toolBySlug } from "@/agent/tools/catalog";
import {
  normalizeParseMode,
  splitTelegramText,
  toPlainText,
} from "@/agent/tools/telegram";
import { simulateTool } from "@/agent/tools/simulate";
import type { LlmToolSpec } from "@/agent/ai/types";

export interface RuntimeTool {
  name: string;
  description: string;
  parameters: z.ZodType | Record<string, unknown>;
  toolSlug: string;
  source: "builtin" | "composio";
}

export interface ToolExecution {
  title: string;
  summary: string;
  output: unknown;
  url?: string;
  browser?: BrowserResearchResult;
}

export interface AgentToolset {
  tools: RuntimeTool[];
  /** Auth-required integrations that are connected for this user. */
  connectedTools: Array<{ slug: string; name: string }>;
  /** Auth-required integrations referenced by the agent but not connected. */
  missingTools: Array<{ slug: string; name: string }>;
  execute(name: string, args: Record<string, unknown>): Promise<ToolExecution>;
}

/* ------------------------------------------------------------------ */
/* Parameter schemas for catalog actions                                */
/* ------------------------------------------------------------------ */

const P = {
  WEB_SEARCH: z.object({
    query: z.string().describe("The search query"),
    recency: z.string().describe("Time window, e.g. 24h, 7d, any"),
    limit: z.number().describe("Maximum number of results"),
  }),
  SERP_GOOGLE_SEARCH: z.object({
    query: z.string().describe("The search query"),
    limit: z.number().describe("Maximum number of results"),
  }),
  SERP_GOOGLE_JOBS: z.object({
    query: z.string().describe("Job title or keywords"),
    location: z.string().describe("Location or 'remote'"),
    limit: z.number().describe("Maximum number of results"),
  }),
  BROWSER_RESEARCH: z.object({
    task: z
      .string()
      .min(10)
      .describe("The complete live web research task to perform"),
  }),
  REDDIT_GET_TOP_POSTS: z.object({
    subreddit: z.string().describe("Subreddit name without r/"),
    time_filter: z.string().describe("hour, day, week, month or year"),
    limit: z.number().describe("Maximum number of posts"),
  }),
  REDDIT_SEARCH_POSTS: z.object({
    query: z.string().describe("Search query"),
    limit: z.number().describe("Maximum number of posts"),
  }),
  GMAIL_FETCH_EMAILS: z.object({
    query: z.string().describe("Gmail search query, e.g. is:unread"),
    maxResults: z.number().describe("Maximum number of emails"),
  }),
  GMAIL_SEND_EMAIL: z.object({
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body (markdown allowed)"),
  }),
  GMAIL_CREATE_EMAIL_DRAFT: z.object({
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body"),
  }),
  OUTLOOK_LIST_MESSAGES: z.object({
    query: z.string().describe("Search query"),
    maxResults: z.number().describe("Maximum number of messages"),
  }),
  OUTLOOK_SEND_EMAIL: z.object({
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body"),
  }),
  SLACK_SEND_MESSAGE: z.object({
    channel: z.string().describe("Channel name or DM, e.g. #general"),
    text: z.string().describe("Message text (markdown allowed)"),
  }),
  SLACK_FETCH_CONVERSATION_HISTORY: z.object({
    channel: z.string().describe("Channel name"),
    limit: z.number().describe("Maximum number of messages"),
  }),
  NOTION_CREATE_PAGE: z.object({
    title: z.string().describe("Page title"),
    content: z.string().describe("Page body (markdown)"),
  }),
  NOTION_QUERY_DATABASE: z.object({
    database_id: z.string().describe("Database id or name"),
    filter: z.string().describe("Filter description"),
  }),
  GOOGLEDOCS_CREATE_DOCUMENT: z.object({
    title: z.string().describe("Document title"),
    content: z.string().describe("Document body (markdown)"),
  }),
  GOOGLEDOCS_APPEND_TEXT: z.object({
    documentId: z.string().describe("Target document id or URL"),
    text: z.string().describe("Text to append"),
  }),
  GOOGLEDRIVE_UPLOAD_FILE: z.object({
    name: z.string().describe("File name"),
    content: z.string().describe("File content"),
  }),
  GOOGLEDRIVE_FIND_FILE: z.object({
    query: z.string().describe("Search query"),
  }),
  GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND: z.object({
    spreadsheetId: z.string().describe("Spreadsheet id or name"),
    range: z.string().describe("A1 range, e.g. Sheet1!A:D"),
    values: z.array(z.array(z.string())).describe("Rows to append"),
  }),
  GOOGLESHEETS_GET_SPREADSHEET_VALUES: z.object({
    spreadsheetId: z.string().describe("Spreadsheet id or name"),
    range: z.string().describe("A1 range"),
  }),
  GITHUB_LIST_PULL_REQUESTS: z.object({
    repository: z.string().describe("owner/repo"),
    state: z.string().describe("open, closed or all"),
    limit: z.number().describe("Maximum number of PRs"),
  }),
  GITHUB_CREATE_ISSUE: z.object({
    title: z.string().describe("Issue title"),
    body: z.string().describe("Issue body"),
  }),
  GITHUB_GET_REPOSITORY: z.object({
    repository: z.string().describe("owner/repo"),
  }),
  GOOGLECALENDAR_LIST_EVENTS: z.object({
    calendarId: z.string().describe("Calendar id, usually primary"),
    timeMin: z.string().describe("ISO start time"),
    maxResults: z.number().describe("Maximum number of events"),
  }),
  GOOGLECALENDAR_CREATE_EVENT: z.object({
    summary: z.string().describe("Event title"),
    start: z.string().describe("ISO start datetime"),
    end: z.string().describe("ISO end datetime"),
    description: z.string().describe("Event description"),
  }),
  DISCORD_SEND_MESSAGE: z.object({
    channel: z.string().describe("Channel name"),
    text: z.string().describe("Message text"),
  }),
  TELEGRAM_SEND_MESSAGE: z.object({
    chatId: z.string().describe("Chat id or @username"),
    text: z.string().describe("Message text"),
  }),
  TWITTER_CREATE_TWEET: z.object({
    text: z.string().describe("Post text"),
  }),
  TWITTER_SEARCH_TWEETS: z.object({
    query: z.string().describe("Search query"),
    limit: z.number().describe("Maximum number of posts"),
  }),
  LINEAR_CREATE_ISSUE: z.object({
    title: z.string().describe("Issue title"),
    description: z.string().describe("Issue description"),
  }),
  LINEAR_LIST_ISSUES: z.object({
    teamId: z.string().describe("Team id or name"),
    limit: z.number().describe("Maximum number of issues"),
  }),
  JIRA_CREATE_ISSUE: z.object({
    title: z.string().describe("Issue title"),
    description: z.string().describe("Issue description"),
  }),
  TRELLO_CREATE_CARD: z.object({
    listId: z.string().describe("List id or name"),
    name: z.string().describe("Card name"),
    description: z.string().describe("Card description"),
  }),
  ASANA_CREATE_TASK: z.object({
    name: z.string().describe("Task name"),
    notes: z.string().describe("Task notes"),
    projectId: z.string().describe("Project id or name"),
  }),
  AIRTABLE_CREATE_RECORD: z.object({
    baseId: z.string().describe("Base id or name"),
    tableId: z.string().describe("Table id or name"),
    fields: z.string().describe("JSON object of field values"),
  }),
  HUBSPOT_CREATE_CONTACT: z.object({
    email: z.string().describe("Contact email"),
    firstname: z.string().describe("First name"),
    lastname: z.string().describe("Last name"),
  }),
  SALESFORCE_QUERY: z.object({
    query: z.string().describe("SOQL query"),
  }),
  STRIPE_LIST_PAYMENTS: z.object({
    limit: z.number().describe("Maximum number of payments"),
  }),
  SHOPIFY_LIST_ORDERS: z.object({
    status: z.string().describe("open, closed or any"),
    limit: z.number().describe("Maximum number of orders"),
  }),
  YOUTUBE_SEARCH_VIDEOS: z.object({
    query: z.string().describe("Search query"),
    limit: z.number().describe("Maximum number of videos"),
  }),
  CALENDLY_LIST_EVENTS: z.object({
    limit: z.number().describe("Maximum number of events"),
  }),
  ZOOM_CREATE_MEETING: z.object({
    topic: z.string().describe("Meeting topic"),
    start_time: z.string().describe("ISO start datetime"),
    duration: z.number().describe("Duration in minutes"),
  }),
} as const satisfies Record<string, z.ZodType>;

const FALLBACK_PARAMETERS = z.object({
  input: z.string().describe("Task input for this action"),
});


/** High-value actions kept for every integration (keeps the LLM payload small). */
const KEY_TOOL_PATTERNS: RegExp[] = [
  /SEND_MESSAGE$/i,
  /GET_UPDATES$/i,
  /GET_CHAT$/i,
  /SEND_EMAIL$/i,
  /FETCH_EMAILS$/i,
  /CREATE_EMAIL_DRAFT$/i,
  /CREATE_DOCUMENT$/i,
  /APPEND_TEXT$/i,
  /CREATE_PAGE$/i,
  /QUERY_DATABASE$/i,
  /GET_R_TOP$/i,
  /SEARCH_POSTS$/i,
  /TOP_POSTS$/i,
  /LIST_EVENTS$/i,
  /CREATE_EVENT$/i,
  /LIST_PULL_REQUESTS$/i,
  /CREATE_ISSUE$/i,
  /GET_REPOSITORY$/i,
  /SEARCH_TWEETS$/i,
  /CREATE_TWEET$/i,
];

/**
 * Pick a small, relevant subset of a toolkit's real tools. Exposing every
 * Composio action blows past free-tier token limits, so rank by keyword
 * overlap with the catalog actions and keep the best few.
 */
function selectRemoteTools<T extends { name: string }>(
  slug: string,
  remoteTools: T[],
  max = 3,
): T[] {
  const tool = toolBySlug.get(slug);
  const tokens = new Set<string>();
  if (tool) {
    for (const action of tool.actions) {
      for (const part of action.slug.split("_")) {
        if (part.length > 3) tokens.add(part.toUpperCase());
      }
    }
  }
  const scored = remoteTools.map((remote, index) => {
    const name = remote.name.toUpperCase();
    let score = 0;
    if (KEY_TOOL_PATTERNS.some((pattern) => pattern.test(name))) score += 5;
    for (const token of tokens) if (name.includes(token)) score += 1;
    return { remote, score, index };
  });
  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, max)
    .map((entry) => entry.remote);
}

/* ------------------------------------------------------------------ */
/* Composio result handling                                             */
/* ------------------------------------------------------------------ */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/**
 * Composio resolves (it does not throw) when the underlying app rejects a
 * request — e.g. Telegram answers 400 for a bad parse_mode or an oversized
 * message. Detect those payloads, otherwise agents report fake successes.
 */
function composioFailure(result: unknown): string | null {
  const root = asRecord(result);
  if (!root) return null;

  const error = root.error;
  if (error) {
    const message = typeof error === "string" ? error : JSON.stringify(error);
    if (message && message !== "null" && message !== "{}") return message.slice(0, 500);
  }
  if (root.successful === false) {
    const data = asRecord(root.data) ?? {};
    const detail = data.message ?? data.error ?? data.description;
    return typeof detail === "string"
      ? detail.slice(0, 500)
      : "Composio reported the action as failed";
  }

  const data = asRecord(root.data) ?? root;
  const status = data.status_code ?? data.statusCode;
  if (typeof status === "number" && status >= 400) {
    const detail = data.message ?? data.error ?? data.description;
    return typeof detail === "string"
      ? detail.slice(0, 500)
      : `The integration rejected the request (HTTP ${status})`;
  }
  if (data.ok === false && typeof data.description === "string") {
    return data.description.slice(0, 500);
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Telegram delivery helpers (shared with the run-finished notifier)    */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Toolset builder                                                      */
/* ------------------------------------------------------------------ */

export async function buildAgentToolset(options: {
  userEmail: string;
  agent: {
    agentId: string;
    tools?: string[] | null;
    composioSessionId?: string | null;
  };
}): Promise<AgentToolset> {
  const slugs = (options.agent.tools ?? []).filter((slug) => toolBySlug.has(slug));
  const isLive = integrationMode() !== "demo";
  const tools: RuntimeTool[] = [];
  const composioFor: string[] = [];

  // Built-in tools (web search, browser automation, SERP) always ship specs.
  for (const slug of slugs) {
    const tool = toolBySlug.get(slug)!;
    if (tool.provider !== "builtin") continue;
    for (const action of tool.actions) {
      tools.push({
        name: action.slug,
        description: `${tool.name}: ${action.description}`,
        parameters: (P as Record<string, z.ZodType>)[action.slug] ?? FALLBACK_PARAMETERS,
        toolSlug: slug,
        source: "builtin",
      });
    }
  }

  // Which integrations are actually connected for this user? Only connected
  // toolkits are exposed to the model, so it can never fake results for an app
  // the user has not authorized.
  const connections = await listConnections(options.userEmail, slugs);
  const connectedSlugs = new Set(
    connections.filter((connection) => connection.connected).map((connection) => connection.slug),
  );

  if (isLive) {
    for (const slug of slugs) {
      const tool = toolBySlug.get(slug)!;
      if (tool.provider === "composio" && tool.toolkit && connectedSlugs.has(slug)) {
        composioFor.push(tool.toolkit);
      }
    }
  }

  const composioTools =
    composioFor.length > 0
      ? await getComposioAgentTools({
          userEmail: options.userEmail,
          agentId: options.agent.agentId,
          toolkitSlugs: Array.from(new Set(composioFor)),
          sessionId: options.agent.composioSessionId,
        })
      : null;

  // Persist the Composio session id so future runs reuse it (tutorial parity).
  if (
    composioTools?.sessionId &&
    composioTools.sessionId !== options.agent.composioSessionId
  ) {
    try {
      const { getDb, schema } = await import("@/db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      await db
        .update(schema.agentConfig)
        .set({ composioSessionId: composioTools.sessionId })
        .where(eq(schema.agentConfig.agentId, options.agent.agentId));
    } catch (error) {
      console.warn("[tools] could not persist Composio session id:", error);
    }
  }

  if (composioTools) {
    // Live mode: expose a focused set of real Composio tools per connected
    // toolkit (session is already scoped to the agent's toolkits).
    for (const slug of slugs) {
      const tool = toolBySlug.get(slug)!;
      if (tool.provider !== "composio") continue;
      if (isLive && tool.toolkit && !connectedSlugs.has(slug)) continue;
      const prefix = (tool.toolkit ?? slug).replace(/[^a-z0-9]/gi, "").toUpperCase();
      const matching = composioTools.tools.filter(
        (remote) => remote.name && remote.name.toUpperCase().startsWith(prefix),
      );
      for (const remote of selectRemoteTools(slug, matching)) {
        tools.push({
          name: remote.name,
          description: (remote.description || remote.name).slice(0, 200),
          parameters: remote.parameters ?? FALLBACK_PARAMETERS,
          toolSlug: slug,
          source: "composio",
        });
      }
    }
  } else if (!isLive) {
    // Demo mode: simulate the auth-required catalog tools.
    for (const slug of slugs) {
      const tool = toolBySlug.get(slug)!;
      if (tool.provider !== "composio") continue;
      for (const action of tool.actions) {
        tools.push({
          name: action.slug,
          description: `${tool.name}: ${action.description}`,
          parameters: (P as Record<string, z.ZodType>)[action.slug] ?? FALLBACK_PARAMETERS,
          toolSlug: slug,
          source: "builtin",
        });
      }
    }
  }

  // Dedupe by name — live Composio tools win over catalog specs.
  const byName = new Map<string, RuntimeTool>();
  for (const tool of tools) byName.set(tool.name.toUpperCase(), tool);
  const finalTools = Array.from(byName.values());

  const describe = (slug: string) => ({
    slug,
    name: toolBySlug.get(slug)?.name ?? slug,
  });
  const authSlugs = slugs.filter((slug) => toolBySlug.get(slug)?.requiresAuth);
  const connectedTools = authSlugs
    .filter((slug) => connectedSlugs.has(slug))
    .map(describe);
  const missingTools = authSlugs
    .filter((slug) => !connectedSlugs.has(slug))
    .map(describe);

  return {
    tools: finalTools,
    connectedTools,
    missingTools,
    async execute(name, args): Promise<ToolExecution> {
      const tool = byName.get(name.toUpperCase());
      if (!tool) {
        return {
          title: `Unknown tool ${name}`,
          summary: `Tool ${name} is not available to this agent.`,
          output: { error: "unknown_tool", tool: name },
        };
      }

      if (tool.source === "composio" && composioTools) {
        // Telegram needs delivery hardening: optional params arrive as empty
        // strings, formatting modes are often invalid, and briefs routinely
        // exceed Telegram's 4096-char cap. Handle delivery here so agents get
        // truthful success/failure feedback.
        if (tool.name.toUpperCase() === "TELEGRAM_SEND_MESSAGE") {
          const raw = asRecord(args) ?? {};
          const chatId = raw.chat_id ?? raw.chatId ?? raw.chat;
          const messageArg = typeof raw.message === "string" ? raw.message : "";
          const textArg = typeof raw.text === "string" ? raw.text : "";
          const text = (messageArg.trim() || textArg.trim()).trim();
          const parseMode = normalizeParseMode(raw.parse_mode ?? raw.parseMode);

          if (!chatId || !text) {
            return {
              title: `${tool.name} failed`,
              summary: `${tool.name} needs both a chat and message text.`,
              output: {
                error: "invalid_arguments",
                tool: tool.name,
                chat_id: chatId ?? null,
                hasText: text.length > 0,
              },
            };
          }

          const chunks = splitTelegramText(text);
          const hasHtmlMarkup = /<\/?(?:b|i|u|s|code|pre|a|p|div|br|span|strong|em)\b/i.test(text);
          // Single-part messages with markup render properly via parse_mode
          // (model-provided, or inferred HTML when tags are present).
          const format =
            parseMode ?? (chunks.length === 1 && hasHtmlMarkup ? "HTML" : undefined);
          const keepFormatting = chunks.length === 1 && Boolean(format);
          const sent: Array<{ messageId: unknown; logId: unknown }> = [];

          for (let index = 0; index < chunks.length; index += 1) {
            const bodyRaw =
              chunks.length > 1
                ? `${chunks[index]}\n\n(${index + 1}/${chunks.length})`
                : chunks[index];
            const body = keepFormatting ? bodyRaw : toPlainText(bodyRaw);
            const payload: Record<string, unknown> = { chat_id: chatId, text: body };
            if (keepFormatting && format) payload.parse_mode = format;

            let result = await composioTools.execute(tool.name, payload);
            let failure = composioFailure(result);

            // Bad entities / formatting errors: retry once as clean plain text.
            if (failure && format && /parse|entit|markdown|html/i.test(failure)) {
              delete payload.parse_mode;
              payload.text = toPlainText(bodyRaw);
              result = await composioTools.execute(tool.name, payload);
              failure = composioFailure(result);
            }

            if (failure) {
              return {
                title: `${tool.name} failed`,
                summary: `Telegram rejected part ${index + 1}/${chunks.length}: ${failure.slice(0, 180)}`,
                output: {
                  error: "tool_failed",
                  tool: tool.name,
                  message: failure,
                  part: index + 1,
                  parts: chunks.length,
                },
              };
            }

            const rootRecord: Record<string, unknown> = asRecord(result) ?? {};
            const data = asRecord(rootRecord.data) ?? rootRecord;
            const inner = asRecord(data.result) ?? data;
            sent.push({
              messageId: inner.message_id ?? inner.messageId ?? null,
              logId: rootRecord.logId ?? null,
            });
          }

          return {
            title:
              chunks.length === 1
                ? "Sent Telegram message"
                : `Sent Telegram message (${chunks.length} parts)`,
            summary: `Delivered to chat ${String(chatId)} — message id${
              sent.length === 1 ? "" : "s"
            } ${sent.map((entry) => String(entry.messageId ?? "?")).join(", ")}.`,
            output: {
              __label: "Telegram",
              delivered: true,
              chat_id: chatId,
              parts: sent.length,
              message_ids: sent.map((entry) => entry.messageId),
              log_ids: sent.map((entry) => entry.logId).filter(Boolean),
            },
          };
        }

        try {
          const result = await composioTools.execute(tool.name, args);
          const failure = composioFailure(result);
          if (failure) {
            return {
              title: `${tool.name} failed`,
              summary: `${tool.name} failed: ${failure.slice(0, 220)}`,
              output: { error: "tool_failed", tool: tool.name, message: failure },
            };
          }
          const data = (result as { data?: unknown })?.data ?? result;
          return {
            title: `${tool.name} executed`,
            summary: `${tool.name} completed through Composio.`,
            output: data,
            url:
              (data as Record<string, unknown>)?.url as string | undefined ??
              (data as Record<string, unknown>)?.permalink as string | undefined,
          };
        } catch (error) {
          return {
            title: `${tool.name} failed`,
            summary: `${tool.name} failed: ${
              error instanceof Error ? error.message : "unknown error"
            }`,
            output: {
              error: "tool_failed",
              tool: tool.name,
              message: error instanceof Error ? error.message : String(error),
            },
          };
        }
      }

      // Real web search when Browserbase is configured (its search quota is
      // separate from cloud-browser agent runs). Falls back to the simulator.
      const actionName = tool.name.toUpperCase();
      if (actionName === "WEB_SEARCH" || actionName === "SERP_GOOGLE_SEARCH") {
        const query = String(args.query ?? "").trim();
        if (query) {
          const live = await browserSearch(query, Number(args.limit ?? 6) || 6);
          if (live && live.length > 0) {
            return {
              title: `Searched the web for “${query}”`,
              summary: `Found ${live.length} live results for “${query}”, led by “${live[0].title}”.`,
              output: {
                __label: "Web Search",
                query,
                engine: "browserbase-search",
                results: live.map((result, index) => ({
                  rank: index + 1,
                  ...result,
                })),
              },
            };
          }
        }
      }

      // Built-in / demo execution.
      if (tool.name.toUpperCase() === "BROWSER_RESEARCH") {
        const task = String(args.task ?? "Research the target website");
        const browser = await browserResearch(task);
        const agentSummary =
          typeof browser.result?.summary === "string"
            ? browser.result.summary.replace(/\s+/g, " ").slice(0, 220)
            : null;
        const planCount = Array.isArray(browser.result?.plans)
          ? (browser.result.plans as unknown[]).length
          : null;
        const methodLabel =
          browser.method === "agent"
            ? "cloud browser"
            : browser.method === "fetch"
              ? "fetch API"
              : browser.method === "search"
                ? "search API"
                : "simulated browser";
        return {
          title: `Browser research: ${browser.status} (${methodLabel})`,
          summary:
            browser.status === "completed"
              ? (agentSummary ??
                `Browsed ${browser.result?.site ?? "the target site"} and extracted ${
                  planCount
                    ? `${planCount} pricing plans`
                    : "the requested data"
                }.${browser.fallbackReason ? " (fallback from agent quota)" : ""}`)
              : `Browser run ${browser.status}${browser.error ? `: ${browser.error}` : ""}.`,
          output: {
            __label: "Browserbase live session",
            status: browser.status,
            method: browser.method ?? "agent",
            fallbackReason: browser.fallbackReason ?? null,
            sessionId: browser.sessionId,
            liveUrl: browser.liveUrl,
            result: browser.result,
            steps: browser.steps,
            error: browser.error,
          },
          url: browser.liveUrl ?? undefined,
          browser,
        };
      }

      const simulated = simulateTool(tool.name, args);
      return {
        title: simulated.title,
        summary: `${simulated.summary} (simulated)`,
        output: {
          ...simulated.output,
          __label: toolBySlug.get(tool.toolSlug)?.name ?? tool.toolSlug,
          __summary: simulated.summary,
          // Demo-mode results must never read as real deliveries — everything
          // that did not leave the app through a live integration is marked.
          __simulated: true,
        },
        url: simulated.url,
      };
    },
  };
}

export function toLlmToolSpecs(toolset: AgentToolset): LlmToolSpec[] {
  return toolset.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters as LlmToolSpec["parameters"],
  }));
}
