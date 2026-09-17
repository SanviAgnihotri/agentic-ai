"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateAgent, type AgentRow } from "./create-agent";
import { MyAgents } from "./my-agents";
import { EditAgentSheet } from "./edit-agent-sheet";
import { ChatDrawer } from "./chat-drawer";
import type { AgentWithRuns } from "./agent-card";

export function AgentsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "mine" ? "mine" : "create";
  const promptParam = searchParams.get("prompt") ?? undefined;
  const [refreshKey, setRefreshKey] = useState(0);
  const [editAgent, setEditAgent] = useState<AgentWithRuns | null>(null);
  const [chatAgent, setChatAgent] = useState<AgentWithRuns | null>(null);

  const setTab = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "create") params.delete("tab");
    else params.set("tab", value);
    router.replace(`/dashboard/agents${params.size ? `?${params.toString()}` : ""}`, {
      scroll: false,
    });
  };

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  const handleCreated = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleViewMyAgents = useCallback(() => {
    refresh();
    setTab("mine");
  }, [refresh, setTab]);

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="flex items-center justify-center">
          <TabsList className="h-11 rounded-lg border border-border/70 bg-muted/40 p-1">
            <TabsTrigger
              value="create"
              className="gap-2 rounded-md px-5 data-[state=active]:bg-background"
            >
              <Sparkles className="size-4" />
              Create agent
            </TabsTrigger>
            <TabsTrigger
              value="mine"
              className="gap-2 rounded-md px-5 data-[state=active]:bg-background"
            >
              <Bot className="size-4" />
              My agents
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="create"
          className="mt-8 rounded-xl focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <CreateAgent
            initialPrompt={promptParam}
            onCreated={handleCreated}
            onViewMyAgents={handleViewMyAgents}
          />
        </TabsContent>
        <TabsContent
          value="mine"
          className="mt-6 rounded-xl focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <MyAgents
            refreshKey={refreshKey}
            onCreate={() => setTab("create")}
            onEdit={setEditAgent}
            onChat={setChatAgent}
            onChanged={refresh}
          />
        </TabsContent>
      </Tabs>

      <EditAgentSheet
        agent={editAgent}
        open={Boolean(editAgent)}
        onOpenChange={(open) => !open && setEditAgent(null)}
        onSaved={refresh}
      />
      <ChatDrawer
        agent={chatAgent}
        open={Boolean(chatAgent)}
        onOpenChange={(open) => !open && setChatAgent(null)}
      />
    </div>
  );
}
