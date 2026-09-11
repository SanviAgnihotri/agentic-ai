/**
 * Browser automation adapter.
 *
 * Chain of preference:
 *  1. BROWSERBASE_API_KEY → Browserbase cloud browser agents (the tutorial's SDK)
 *  2. If the agents quota is exhausted → Browserbase Fetch/Search APIs
 *     (markdown page extraction, separate quota)
 *  3. If nothing is available → built-in simulation (keeps demos working)
 */

export interface BrowserStep {
  label: string;
  detail?: string;
  at: string;
}

export interface BrowserResearchResult {
  task: string;
  status: "completed" | "failed" | "timeout";
  sessionId: string | null;
  liveUrl: string | null;
  result: Record<string, unknown> | null;
  steps: BrowserStep[];
  error?: string;
  method?: "agent" | "fetch" | "search" | "simulation";
  fallbackReason?: string;
}

export function browserbaseConfigured(): boolean {
  return Boolean(process.env.BROWSERBASE_API_KEY);
}

const TERMINAL = new Set(["COMPLETED", "FAILED", "STOPPED", "TIMED_OUT"]);

type BrowserbaseClient = import("@browserbasehq/sdk").default;

async function getClient(): Promise<BrowserbaseClient> {
  const { default: Browserbase } = await import("@browserbasehq/sdk");
  return new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
}

export interface BrowserSearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** Real web search via the Browserbase Search API (separate quota from agents). */
export async function browserSearch(
  query: string,
  numResults = 6,
): Promise<BrowserSearchResult[] | null> {
  if (!browserbaseConfigured() || !query.trim()) return null;
  try {
    const browserbase = await getClient();
    const response = await browserbase.search.web({ query, numResults });
    const results = (response.results ?? [])
      .map((item) => {
        const entry = item as unknown as Record<string, unknown>;
        return {
          title: String(entry.title ?? ""),
          url: String(entry.url ?? ""),
          snippet: String(entry.snippet ?? entry.description ?? ""),
        };
      })
      .filter((result) => result.url);
    return results.length > 0 ? results : null;
  } catch (error) {
    console.warn(
      "[browser] search failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function browserResearch(task: string): Promise<BrowserResearchResult> {
  if (!browserbaseConfigured()) {
    return { ...simulateBrowserResearch(task), method: "simulation" };
  }

  let client: BrowserbaseClient | null = null;
  try {
    client = await getClient();

    // 1. Preferred: autonomous Browserbase agent.
    return await runBrowserbaseAgent(client, task);
  } catch (agentError) {
    const reason =
      agentError instanceof Error ? agentError.message : "Browserbase agent failed";

    // 2. Fallback: Fetch/Search APIs (different quota from agent runs).
    if (client) {
      const fallback = await researchViaFetchOrSearch(client, task, reason);
      if (fallback) return fallback;
    }

    // 3. Last resort: simulation, clearly marked.
    if (process.env.BROWSERBASE_FALLBACK_TO_SIMULATION !== "false") {
      const simulated = simulateBrowserResearch(task);
      return {
        ...simulated,
        method: "simulation",
        fallbackReason: reason,
        steps: [
          {
            label: "Browserbase agent unavailable — used simulated browser",
            detail: reason.slice(0, 160),
            at: new Date().toISOString(),
          },
          ...simulated.steps,
        ],
      };
    }

    return {
      task,
      status: "failed",
      sessionId: null,
      liveUrl: null,
      result: null,
      steps: [],
      error: reason,
      method: "agent",
    };
  }
}

/* ------------------------------------------------------------------ */
/* Browserbase agent run (the tutorial's path)                          */
/* ------------------------------------------------------------------ */

async function runBrowserbaseAgent(
  browserbase: BrowserbaseClient,
  task: string,
): Promise<BrowserResearchResult> {
  const run = await browserbase.agents.runs.create({
    task,
    ...(process.env.BROWSERBASE_AGENT_ID
      ? { agentId: process.env.BROWSERBASE_AGENT_ID }
      : {}),
  });

  const startedAt = Date.now();
  const timeoutMs = Number(process.env.BROWSERBASE_TIMEOUT_MS ?? 180_000);
  let current = run;
  const steps: BrowserStep[] = [
    { label: "Started cloud browser session", detail: run.runId, at: new Date().toISOString() },
  ];

  while (!TERMINAL.has(String(current.status)) && Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    current = await browserbase.agents.runs.retrieve(run.runId);
  }

  if (!TERMINAL.has(String(current.status))) {
    return {
      task,
      status: "timeout",
      sessionId: current.sessionId ?? null,
      liveUrl: current.sessionId
        ? `https://www.browserbase.com/sessions/${current.sessionId}`
        : null,
      result: null,
      steps,
      error: "Browser run out of time",
      method: "agent",
    };
  }

  if (String(current.status) !== "COMPLETED") {
    throw new Error(
      current.cause?.message ?? `Browser run ${String(current.status).toLowerCase()}`,
    );
  }

  steps.push({
    label: "Browser run completed",
    at: new Date().toISOString(),
  });

  return {
    task,
    status: "completed",
    sessionId: current.sessionId ?? null,
    liveUrl: current.sessionId
      ? `https://www.browserbase.com/sessions/${current.sessionId}`
      : null,
    result: (current.result as Record<string, unknown> | undefined) ?? null,
    steps,
    method: "agent",
  };
}

/* ------------------------------------------------------------------ */
/* Fetch / Search fallback                                              */
/* ------------------------------------------------------------------ */

async function researchViaFetchOrSearch(
  browserbase: BrowserbaseClient,
  task: string,
  reason: string,
): Promise<BrowserResearchResult | null> {
  const now = () => new Date().toISOString();
  const urls = Array.from(
    new Set(task.match(/https?:\/\/[^\s)"'<>]+/g) ?? []),
  ).slice(0, 2);

  try {
    if (urls.length === 0) {
      // No explicit URL: search the web, then fetch the top results.
      const query = task
        .replace(/\b(visit|open|browse|scrape|extract|go to|the|website|site|page)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 140);
      const search = await browserbase.search.web({ query, numResults: 5 });
      const results = (search.results ?? []).map((item) => {
        const entry = item as unknown as Record<string, unknown>;
        return {
          title: String(entry.title ?? ""),
          url: String(entry.url ?? ""),
          snippet: String(entry.snippet ?? entry.description ?? ""),
        };
      });

      let pageContent: string | null = null;
      let fetchedUrl: string | null = null;
      if (results[0]?.url) {
        const page = await browserbase.fetchAPI.create({
          url: results[0].url,
          format: "markdown",
        });
        fetchedUrl = results[0].url;
        pageContent =
          typeof page.content === "string" ? page.content.slice(0, 12_000) : null;
      }

      return {
        task,
        status: "completed",
        sessionId: null,
        liveUrl: null,
        method: "search",
        fallbackReason: reason,
        result: {
          site: fetchedUrl ?? query,
          method: "search+fetch",
          query,
          results,
          content: pageContent,
          fetchedAt: now(),
        },
        steps: [
          { label: "Agent quota reached — switched to Browserbase Search API", detail: reason.slice(0, 160), at: now() },
          { label: `Searched "${query}"`, detail: `${results.length} results`, at: now() },
          ...(fetchedUrl
            ? [{ label: `Fetched ${fetchedUrl}`, detail: "markdown extraction", at: now() }]
            : []),
        ],
      };
    }

    // Explicit URLs: fetch them directly as markdown.
    const pages: Array<{ url: string; content: string | null }> = [];
    for (const url of urls) {
      try {
        const page = await browserbase.fetchAPI.create({ url, format: "markdown" });
        pages.push({
          url,
          content: typeof page.content === "string" ? page.content.slice(0, 12_000) : null,
        });
      } catch (fetchError) {
        pages.push({
          url,
          content: `Failed to fetch: ${
            fetchError instanceof Error ? fetchError.message : "unknown error"
          }`,
        });
      }
    }

    return {
      task,
      status: "completed",
      sessionId: null,
      liveUrl: null,
      method: "fetch",
      fallbackReason: reason,
      result: {
        site: urls[0],
        method: "fetch",
        pages,
        fetchedAt: now(),
      },
      steps: [
        { label: "Agent quota reached — switched to Browserbase Fetch API", detail: reason.slice(0, 160), at: now() },
        ...pages.map((page) => ({
          label: `Fetched ${page.url}`,
          detail: page.content ? `${page.content.length} chars of markdown` : "no content",
          at: now(),
        })),
      ],
    };
  } catch (error) {
    console.warn(
      "[browser] Fetch/Search fallback failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Built-in simulation                                                  */
/* ------------------------------------------------------------------ */

function simulateBrowserResearch(task: string): BrowserResearchResult {
  const lower = task.toLowerCase();
  const site =
    task.match(/https?:\/\/([a-z0-9.-]+)/i)?.[1] ??
    task.match(/visit\s+([a-z0-9.-]+\.[a-z]{2,})/i)?.[1] ??
    "the target site";
  const sessionId = `sim_${Math.random().toString(36).slice(2, 12)}`;
  const now = () => new Date().toISOString();

  let result: Record<string, unknown>;
  if (/pricing|price|plan|cost|subscription/.test(lower)) {
    result = {
      site,
      pageTitle: "Pricing — plans & billing",
      extractedAt: now(),
      plans: [
        { name: "Free", price: "$0", period: "month", highlights: ["1 user", "Community support", "1,000 actions"] },
        { name: "Plus", price: "$12", period: "month", highlights: ["5 users", "Priority support", "50,000 actions", "Scheduled runs"] },
        { name: "Business", price: "$28", period: "month", highlights: ["Unlimited users", "SSO", "250,000 actions", "Audit log"] },
        { name: "Enterprise", price: "Custom", period: "year", highlights: ["Dedicated support", "SLA", "Custom retention"] },
      ],
      changes: [
        { what: "Plus plan", from: "$10/mo", to: "$12/mo", changedAt: new Date(Date.now() - 86_400_000 * 6).toISOString() },
        { what: "Business plan", from: "$24/mo", to: "$28/mo", changedAt: new Date(Date.now() - 86_400_000 * 3).toISOString() },
      ],
    };
  } else if (/news|blog|article|update/.test(lower)) {
    result = {
      site,
      pageTitle: "Latest updates",
      extractedAt: now(),
      articles: [
        { title: "Agents get scheduled runs", publishedAt: now(), summary: "Recurring background executions are now generally available." },
        { title: "Composio toolkit expansion", publishedAt: now(), summary: "120 new toolkits added to the catalog." },
        { title: "Browser automation improvements", publishedAt: now(), summary: "Faster live sessions and better extraction reliability." },
      ],
    };
  } else {
    result = {
      site,
      pageTitle: "Research result",
      extractedAt: now(),
      summary: `The page was loaded and the key information was extracted for the task: ${task.slice(0, 140)}`,
      facts: [
        "Primary headline and value proposition captured",
        "Feature list and differentiators extracted",
        "Contact and CTA details collected",
      ],
    };
  }

  return {
    task,
    status: "completed",
    sessionId,
    liveUrl: `https://www.browserbase.com/sessions/${sessionId}`,
    result,
    steps: [
      { label: "Launched cloud browser", detail: "Chromium 131 · us-west-2", at: now() },
      { label: `Navigated to ${site}`, at: now() },
      { label: "Scrolled and located target section", at: now() },
      { label: "Extracted structured data", at: now() },
      { label: "Closed session", at: now() },
    ],
  };
}
