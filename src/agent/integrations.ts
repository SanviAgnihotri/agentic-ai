import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { toolBySlug, TOOL_CATALOG, TOOL_CATEGORIES } from "@/agent/tools/catalog";

/**
 * Integration connections adapter.
 *
 *  - "composio" → Composio SDK with a project API key (COMPOSIO_API_KEY);
 *                 connections are scoped per user (userId = app user email)
 *  - "demo"     → connections stored in `tool_connections`, tools simulated
 */

export type IntegrationMode = "composio" | "demo";

export interface ToolConnectionStatus {
  slug: string;
  name: string;
  icon: string;
  color: string;
  connected: boolean;
  accountLabel: string | null;
  externalId: string | null;
}

export function integrationMode(): IntegrationMode {
  return process.env.COMPOSIO_API_KEY ? "composio" : "demo";
}

type ComposioHealth = { ok: boolean; error?: string; checkedAt: number };
let composioHealth: ComposioHealth | null = null;

/**
 * Cheap, cached health check for the Composio key so the UI can distinguish
 * "live" from "key present but rejected" instead of silently showing demo data.
 */
export async function composioHealthCheck(): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.COMPOSIO_API_KEY) {
    return { ok: false, error: "COMPOSIO_API_KEY is not set" };
  }
  if (composioHealth && Date.now() - composioHealth.checkedAt < 60_000) {
    return composioHealth;
  }
  try {
    const composio = await getComposio();
    await composio.connectedAccounts.list({});
    composioHealth = { ok: true, checkedAt: Date.now() };
  } catch (error) {
    composioHealth = {
      ok: false,
      error: error instanceof Error ? error.message : "Composio request failed",
      checkedAt: Date.now(),
    };
  }
  return composioHealth;
}

type LooseSession = {
  sessionId?: string;
  id?: string;
  tools?: unknown;
  execute?: (slug: string, args: Record<string, unknown>) => Promise<unknown>;
  authorize: (
    toolkit: string,
    options?: { callbackUrl?: string; alias?: string },
  ) => Promise<Record<string, unknown>>;
  toolkits: (options?: {
    toolkits?: string[];
    limit?: number;
    isConnected?: boolean;
  }) => Promise<{ items?: Array<Record<string, unknown>> }>;
};

type LooseComposio = {
  connectedAccounts: {
    list(params?: {
      userIds?: string[];
    }): Promise<{ items?: Array<Record<string, unknown>> }>;
    delete(id: string): Promise<unknown>;
  };
  sessions: {
    create(
      userId: string,
      config?: {
        toolkits?: string[];
        sessionPreset?: unknown;
      },
    ): Promise<LooseSession>;
    use(id: string): Promise<LooseSession>;
  };
};

let composioClient: LooseComposio | null = null;

async function getComposio(): Promise<LooseComposio> {
  if (!composioClient) {
    const { Composio } = await import("@composio/core");
    composioClient = new Composio({
      apiKey: process.env.COMPOSIO_API_KEY,
    }) as unknown as LooseComposio;
  }
  return composioClient;
}

const userSessionCache = new Map<string, { session: LooseSession; createdAt: number }>();
const USER_SESSION_TTL = 30 * 60 * 1000;

/** One session per app user (the documented Pattern for connection state + auth). */
async function getUserSession(userEmail: string): Promise<LooseSession> {
  const cached = userSessionCache.get(userEmail);
  if (cached && Date.now() - cached.createdAt < USER_SESSION_TTL) {
    return cached.session;
  }
  const composio = await getComposio();
  const session = await composio.sessions.create(userEmail);
  userSessionCache.set(userEmail, { session, createdAt: Date.now() });
  return session;
}

/* ------------------------------------------------------------------ */
/* Connections                                                          */
/* ------------------------------------------------------------------ */

export async function listConnections(
  userEmail: string,
  slugs?: string[],
): Promise<ToolConnectionStatus[]> {
  const requested = slugs?.filter((slug) => toolBySlug.has(slug)) ?? [];

  if (integrationMode() === "composio") {
    const health = await composioHealthCheck();
    if (health.ok) {
      try {
        const session = await getUserSession(userEmail);
        const wantedAuthSlugs = (
          requested.length ? requested : Array.from(toolBySlug.keys())
        ).filter((slug) => toolBySlug.get(slug)?.requiresAuth);
        const toolkitSlugs = Array.from(
          new Set(wantedAuthSlugs.map((slug) => toolBySlug.get(slug)?.toolkit ?? slug)),
        );
        const result = toolkitSlugs.length
          ? await session.toolkits({ toolkits: toolkitSlugs, limit: 50 })
          : { items: [] };
        const connectionBySlug = new Map<string, Record<string, unknown>>();
        for (const item of result.items ?? []) {
          const slug = String(item.slug ?? "").toLowerCase();
          const connection = item.connection as Record<string, unknown> | undefined;
          if (slug && connection) connectionBySlug.set(slug, connection);
        }
        return (requested.length ? requested : Array.from(toolBySlug.keys())).map(
          (slug) => {
            const tool = toolBySlug.get(slug)!;
            if (!tool.requiresAuth || !tool.toolkit) {
              return {
                slug,
                name: tool.name,
                icon: tool.icon,
                color: tool.color,
                connected: true,
                accountLabel: "Built-in",
                externalId: null,
              };
            }
            const connection = connectionBySlug.get(tool.toolkit.toLowerCase());
            const account = (connection?.connectedAccount ?? null) as Record<
              string,
              unknown
            > | null;
            return {
              slug,
              name: tool.name,
              icon: tool.icon,
              color: tool.color,
              connected: Boolean(connection?.isActive),
              accountLabel: (account?.alias as string) ?? null,
              externalId: (account?.id as string) ?? null,
            };
          },
        );
      } catch (error) {
        console.warn("[integrations] Composio list failed, falling back to demo:", error);
      }
    }
  }

  const db = await getDb();
  const rows = requested.length
    ? await db
        .select()
        .from(schema.toolConnections)
        .where(
          and(
            eq(schema.toolConnections.userEmail, userEmail),
            inArray(schema.toolConnections.slug, requested),
          ),
        )
    : await db
        .select()
        .from(schema.toolConnections)
        .where(eq(schema.toolConnections.userEmail, userEmail));

  const byslug = new Map(rows.map((row) => [row.slug, row]));
  return (requested.length ? requested : Array.from(toolBySlug.keys())).map((slug) => {
    const tool = toolBySlug.get(slug)!;
    const row = byslug.get(slug);
    return {
      slug,
      name: tool.name,
      icon: tool.icon,
      color: tool.color,
      connected: row?.status === "connected",
      accountLabel: row?.accountLabel ?? null,
      externalId: row?.externalId ?? null,
    };
  });
}

export async function connectTool(
  userEmail: string,
  slug: string,
): Promise<{ redirectUrl: string | null; connected: boolean; accountLabel: string | null }> {
  const tool = toolBySlug.get(slug);
  if (!tool) throw new Error("Unknown tool");

  if (integrationMode() === "composio" && tool.toolkit) {
    const composio = await getComposio();

    // Clean up stale/pending connections for this toolkit so a fresh Connect
    // Link never collides with an old alias or half-finished authorization.
    try {
      const accounts = await composio.connectedAccounts.list({ userIds: [userEmail] });
      for (const item of accounts.items ?? []) {
        const toolkit = item.toolkit as Record<string, unknown> | undefined;
        const slug = String(toolkit?.slug ?? "").toLowerCase();
        const status = String(item.status ?? "").toUpperCase();
        if (slug === tool.toolkit.toLowerCase() && status !== "ACTIVE" && item.id) {
          await composio.connectedAccounts.delete(String(item.id));
        }
      }
    } catch (error) {
      console.warn("[integrations] stale connection cleanup skipped:", error);
    }

    const session = await getUserSession(userEmail);
    const request = await session.authorize(tool.toolkit);
    invalidateIntegrationsCache(userEmail);
    return {
      redirectUrl:
        (request.redirectUrl as string) ??
        (request.redirect_url as string) ??
        null,
      connected: false,
      accountLabel: null,
    };
  }

  const db = await getDb();
  const existing = await db
    .select()
    .from(schema.toolConnections)
    .where(
      and(
        eq(schema.toolConnections.userEmail, userEmail),
        eq(schema.toolConnections.slug, slug),
      ),
    )
    .limit(1);

  const label = demoAccountLabel(slug);
  if (existing[0]) {
    await db
      .update(schema.toolConnections)
      .set({ status: "connected", accountLabel: label, updatedAt: new Date() })
      .where(eq(schema.toolConnections.id, existing[0].id));
  } else {
    await db.insert(schema.toolConnections).values({
      userEmail,
      slug,
      accountLabel: label,
      status: "connected",
      externalId: `demo_${slug}_${Date.now().toString(36)}`,
    });
  }
  invalidateIntegrationsCache(userEmail);
  return { redirectUrl: null, connected: true, accountLabel: label };
}

export async function disconnectTool(
  userEmail: string,
  slug: string,
): Promise<{ success: boolean }> {
  if (integrationMode() === "composio") {
    try {
      const composio = await getComposio();
      const accounts = await composio.connectedAccounts.list({ userIds: [userEmail] });
      const tool = toolBySlug.get(slug);
      const toolkitSlug = (tool?.toolkit ?? slug).toLowerCase();
      const match = (accounts.items ?? []).find((item) => {
        const toolkit = item.toolkit as Record<string, unknown> | undefined;
        return String(toolkit?.slug ?? "").toLowerCase() === toolkitSlug;
      });
      if (match?.id) {
        await composio.connectedAccounts.delete(String(match.id));
        invalidateIntegrationsCache(userEmail);
        return { success: true };
      }
    } catch (error) {
      console.warn("[integrations] Composio disconnect failed:", error);
    }
  }

  const db = await getDb();
  await db
    .delete(schema.toolConnections)
    .where(
      and(
        eq(schema.toolConnections.userEmail, userEmail),
        eq(schema.toolConnections.slug, slug),
      ),
    );
  invalidateIntegrationsCache(userEmail);
  return { success: true };
}

export async function isToolConnected(
  userEmail: string,
  slug: string,
): Promise<boolean> {
  const connections = await listConnections(userEmail, [slug]);
  return connections[0]?.connected ?? false;
}

/* ------------------------------------------------------------------ */
/* Integrations overview (cached; shared by the page and the API)       */
/* ------------------------------------------------------------------ */

export interface IntegrationToolView {
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  requiresAuth: boolean;
  provider: string;
  actions: Array<{ slug: string; name: string; description: string }>;
  connected: boolean;
  accountLabel: string | null;
}

export interface IntegrationsOverview {
  tools: IntegrationToolView[];
  categories: string[];
  mode: "composio" | "demo";
  warning?: string;
  connectedCount: number;
}

type OverviewCacheEntry = { at: number; value: IntegrationsOverview };
const globalForOverview = globalThis as unknown as {
  __groovyIntegrations?: Map<string, OverviewCacheEntry>;
};
const overviewCache = (globalForOverview.__groovyIntegrations ??= new Map());
const OVERVIEW_TTL = 60_000;
const OVERVIEW_STALE_TTL = 10 * 60_000;

export function invalidateIntegrationsCache(userEmail?: string): void {
  if (!userEmail) {
    overviewCache.clear();
    return;
  }
  overviewCache.delete(userEmail);
  // Agent toolsets cache Composio sessions per user+agent; refresh them too.
  for (const key of sessionCache.keys()) {
    if (key.startsWith(`${userEmail}:`)) sessionCache.delete(key);
  }
}

/** One cached snapshot of the integrations page data per user. */
export async function getIntegrationsOverview(
  userEmail: string,
): Promise<IntegrationsOverview> {
  const cached = overviewCache.get(userEmail);
  if (cached && Date.now() - cached.at < OVERVIEW_TTL) {
    return cached.value;
  }
  // Stale-while-revalidate: serve the previous snapshot instantly and refresh
  // in the background so page loads never wait on Composio.
  if (cached && Date.now() - cached.at < OVERVIEW_STALE_TTL) {
    void computeOverview(userEmail).catch((error) => {
      console.warn("[integrations] background refresh failed:", error);
    });
    return cached.value;
  }
  return computeOverview(userEmail);
}

async function computeOverview(userEmail: string): Promise<IntegrationsOverview> {
  const connections = await listConnections(userEmail);
  const bySlug = new Map(connections.map((connection) => [connection.slug, connection]));
  const tools = TOOL_CATALOG.map((tool) => {
    const connection = bySlug.get(tool.slug);
    return {
      slug: tool.slug,
      name: tool.name,
      description: tool.description,
      category: tool.category,
      icon: tool.icon,
      color: tool.color,
      requiresAuth: tool.requiresAuth,
      provider: tool.provider,
      actions: tool.actions,
      connected: connection?.connected ?? false,
      accountLabel: connection?.accountLabel ?? null,
    };
  });

  const health = await composioHealthCheck();
  const warning =
    process.env.COMPOSIO_API_KEY && !health.ok
      ? `Composio key rejected — showing demo connections. ${health.error ?? ""}`.trim()
      : undefined;

  const value: IntegrationsOverview = {
    tools,
    categories: TOOL_CATEGORIES,
    mode: health.ok ? "composio" : "demo",
    warning,
    connectedCount: tools.filter((tool) => tool.connected).length,
  };
  overviewCache.set(userEmail, { at: Date.now(), value });
  return value;
}

function demoAccountLabel(slug: string): string {
  const tool = toolBySlug.get(slug);
  if (!tool) return "Connected account";
  const labels: Record<string, string> = {
    gmail: "you@gmail.com",
    slack: "groovy-workspace",
    notion: "Groovy Workspace",
    googledocs: "you@gmail.com",
    googlecalendar: "you@gmail.com",
    googledrive: "you@gmail.com",
    googlesheets: "you@gmail.com",
    github: "groovy-ai",
    reddit: "u/groovy_founder",
    outlook: "you@outlook.com",
    discord: "groovy server",
    twitter: "@groovy_ai",
    telegram: "@groovy_ai",
    linear: "groovy",
    jira: "GROOVY",
    trello: "Agent Boards",
    asana: "Groovy Ops",
    hubspot: "Groovy CRM",
    salesforce: "Groovy Inc",
    stripe: "Groovy Inc",
    shopify: "groovy-store",
    dropbox: "Groovy Team",
    youtube: "Groovy AI",
    calendly: "groovy-ai",
    zoom: "you@company.com",
    airtable: "Agent Ops",
  };
  return labels[slug] ?? `${tool.name} account`;
}

/* ------------------------------------------------------------------ */
/* Composio tool execution for the engine                               */
/* ------------------------------------------------------------------ */

export interface ComposioAgentTools {
  sessionId: string;
  tools: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown> | null;
  }>;
  execute(actionSlug: string, args: Record<string, unknown>): Promise<unknown>;
}

const sessionCache = new Map<string, ComposioAgentTools>();

export async function getComposioAgentTools(options: {
  userEmail: string;
  agentId: string;
  toolkitSlugs: string[];
  sessionId?: string | null;
}): Promise<ComposioAgentTools | null> {
  if (integrationMode() !== "composio" || options.toolkitSlugs.length === 0) {
    return null;
  }
  const health = await composioHealthCheck();
  if (!health.ok) return null;

  const cacheKey = `${options.userEmail}:${options.agentId}`;
  const cached = sessionCache.get(cacheKey);
  if (cached) return cached;

  try {
    const composio = await getComposio();
    const { SessionPreset } = await import("@composio/core");

    const fetchTools = async (target: LooseSession) => {
      const raw = await Promise.resolve(
        typeof target.tools === "function"
          ? (target.tools as () => Promise<unknown>)()
          : target.tools,
      );
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { items?: unknown[] })?.items)
          ? (raw as { items: unknown[] }).items
          : [];
      return list
        .map((entry) => {
          const item = entry as Record<string, unknown>;
          // Composio sessions use an OpenAI provider shape: { type, function: {...} }.
          const fn = (item.function ?? {}) as Record<string, unknown>;
          return {
            name: String(item.slug ?? item.name ?? fn.name ?? ""),
            description: String(
              item.description ?? fn.description ?? item.name ?? fn.name ?? "",
            ),
            parameters:
              (item.inputParameters as Record<string, unknown> | undefined) ??
              (item.parameters as Record<string, unknown> | undefined) ??
              (fn.parameters as Record<string, unknown> | undefined) ??
              null,
          };
        })
        .filter((tool) => tool.name.length > 0);
    };

    const createSession = () =>
      composio.sessions.create(options.userEmail, {
        toolkits: options.toolkitSlugs,
        // Expose the agent's concrete toolkit tools (not just meta-tools) so the
        // engine can call them directly with session.execute().
        sessionPreset: SessionPreset.DIRECT_TOOLS,
      });

    let session: LooseSession | null = null;

    // Reuse the persisted session when possible (the tutorial's pattern).
    if (options.sessionId) {
      try {
        session = await composio.sessions.use(options.sessionId);
      } catch (error) {
        console.warn(
          "[integrations] Composio session reuse failed, creating a new one:",
          error instanceof Error ? error.message : error,
        );
      }
    }
    if (!session) session = await createSession();

    let tools = await fetchTools(session);

    // Sessions created before the direct-tools preset only expose meta-tools.
    // Detect that and upgrade to a fresh session so real actions are available.
    const prefixes = options.toolkitSlugs.map((slug) =>
      slug.replace(/[^a-z0-9]/gi, "").toUpperCase(),
    );
    const hasConcreteTools = tools.some((tool) =>
      prefixes.some((prefix) => tool.name.toUpperCase().startsWith(prefix)),
    );
    if (!hasConcreteTools) {
      session = await createSession();
      tools = await fetchTools(session);
    }

    const sessionId = String(session.sessionId ?? session.id ?? "");

    const execute = async (actionSlug: string, args: Record<string, unknown>) => {
      const result = await (
        session!.execute as (
          slug: string,
          params: Record<string, unknown>,
        ) => Promise<unknown>
      ).call(session, actionSlug, args);
      return result;
    };

    const value: ComposioAgentTools = { sessionId, tools, execute };
    sessionCache.set(cacheKey, value);
    return value;
  } catch (error) {
    console.warn("[integrations] Composio session failed:", error);
    return null;
  }
}
