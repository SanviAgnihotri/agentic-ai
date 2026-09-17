"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Blocks,
  Check,
  Loader2,
  Plug,
  Search,
  SearchX,
  ShieldOff,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { ToolIcon } from "@/components/shared/tool-icon";
import { apiFetch } from "@/hooks/use-poll";
import { TOOL_CATALOG } from "@/agent/tools/catalog";
import { cn } from "@/lib/utils";

interface IntegrationTool {
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

interface IntegrationsResponse {
  tools: IntegrationTool[];
  categories: string[];
  mode: "composio" | "demo";
  warning?: string;
  connectedCount: number;
}

/** The catalog is static config — the grid paints from it synchronously, no
 *  loading shutter. Connection status hydrates from /api/integrations. */
const STATIC_TOOLS: IntegrationTool[] = TOOL_CATALOG.map((tool) => ({
  slug: tool.slug,
  name: tool.name,
  description: tool.description ?? "",
  category: tool.category,
  icon: tool.icon,
  color: tool.color,
  requiresAuth: tool.requiresAuth ?? true,
  provider: tool.provider ?? "composio",
  actions: tool.actions,
  connected: false,
  accountLabel: null,
}));

const STATIC_CATEGORIES = [
  "all",
  ...Array.from(new Set(STATIC_TOOLS.map((tool) => tool.category))),
];

export function IntegrationsView() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [data, setData] = useState<IntegrationsResponse>({
    tools: STATIC_TOOLS,
    categories: STATIC_CATEGORIES.slice(1),
    mode: "demo",
    connectedCount: 0,
  });

  const refresh = useCallback(async () => {
    try {
      const value = await apiFetch<IntegrationsResponse>("/api/integrations");
      setData(value);
    } catch {
      // keep showing the static catalog + previous connection state
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const tools = useMemo(() => {
    const list = data?.tools ?? [];
    return list.filter((tool) => {
      const matchesQuery =
        !query ||
        `${tool.name} ${tool.description} ${tool.category}`
          .toLowerCase()
          .includes(query.toLowerCase());
      const matchesCategory = category === "all" || tool.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [data?.tools, query, category]);

  const connect = async (tool: IntegrationTool) => {
    setBusy(tool.slug);
    try {
      const result = await apiFetch<{ redirectUrl: string | null; connected: boolean }>(
        "/api/integrations",
        { method: "POST", json: { slug: tool.slug } },
      );
      if (result.redirectUrl) {
        window.open(result.redirectUrl, "_blank", "noopener,noreferrer");
        toast.info("Finish connecting in the new tab, then refresh.");
      } else {
        toast.success(`${tool.name} connected`);
        await refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not connect");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (tool: IntegrationTool) => {
    setBusy(tool.slug);
    try {
      await apiFetch("/api/integrations", {
        method: "DELETE",
        json: { slug: tool.slug },
      });
      toast.success(`${tool.name} disconnected`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect");
    } finally {
      setBusy(null);
    }
  };

  const categories = ["all", ...(data?.categories ?? [])];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
          <p className="text-sm text-muted-foreground">
            Connect the apps your agents read from and write to. Built-in tools work
            instantly.
          </p>
        </div>
      </div>

      {data?.warning && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400"
        >
          <ShieldOff className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Composio is not connected</p>
            <p className="mt-0.5 text-amber-700/80 dark:text-amber-400/80">
              {data.warning} Add a valid <code className="rounded bg-amber-500/15 px-1">COMPOSIO_API_KEY</code> from
              dashboard.composio.dev → API Keys and restart the server.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search 100+ integrations…"
              aria-label="Search integrations"
              type="search"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 text-sm tabular-nums text-muted-foreground">
            <Plug className="size-4" />
            {data?.connectedCount ?? 0} connected
          </div>
        </CardContent>
      </Card>

      <Tabs value={category} onValueChange={setCategory}>
        <TabsList className="h-9 max-w-full flex-nowrap overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((item) => (
            <TabsTrigger
              key={item}
              value={item}
              className="shrink-0 text-xs capitalize"
            >
              {item === "all" ? "All" : item}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tools.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No integrations match"
          description="Try a different search term or category — or clear the filters to see everything."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Card
            key={tool.slug}
            className={cn(
              "flex flex-col border-border/70 transition hover:border-foreground/15",
              tool.connected && "border-emerald-500/25",
            )}
          >
            <CardHeader className="flex flex-row items-start gap-3 space-y-0">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted">
                <ToolIcon name={tool.icon} slug={tool.slug} color={tool.color} className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-[15px]">
                  <span className="min-w-0 truncate">{tool.name}</span>
                  {tool.connected && (
                    <Badge className="shrink-0 gap-1 border-green-500/25 bg-green-500/10 text-green-600 dark:text-green-400">
                      <Check className="size-3" />
                      Connected
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-1 line-clamp-2 text-xs">
                  {tool.description}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px]">
                  {tool.category}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {tool.requiresAuth ? "OAuth" : "Built-in"}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {tool.actions.length} action{tool.actions.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-muted-foreground">
                  {tool.connected
                    ? (tool.accountLabel ?? "Connected account")
                    : tool.requiresAuth
                      ? "Not connected"
                      : "No connection needed"}
                </span>
                {tool.requiresAuth &&
                  (tool.connected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => void disconnect(tool)}
                      disabled={busy === tool.slug}
                    >
                      {busy === tool.slug ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <ShieldOff className="size-3" />
                      )}
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => void connect(tool)}
                      disabled={busy === tool.slug}
                    >
                      {busy === tool.slug ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Blocks className="size-3" />
                      )}
                      Connect
                    </Button>
                  ))}
              </div>
            </CardContent>
          </Card>
        ))}
        </div>
      )}
    </div>
  );
}
