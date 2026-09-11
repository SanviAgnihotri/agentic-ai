"use client";

import { useMemo, useState } from "react";
import { Bot, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { apiFetch, usePoll } from "@/hooks/use-poll";
import { AgentCard, type AgentWithRuns } from "./agent-card";

export function MyAgents({
  refreshKey,
  onCreate,
  onEdit,
  onChat,
  onChanged,
}: {
  refreshKey: number;
  onCreate: () => void;
  onEdit: (agent: AgentWithRuns) => void;
  onChat: (agent: AgentWithRuns) => void;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, loading } = usePoll<{ agents: AgentWithRuns[] }>(
    () => apiFetch<{ agents: AgentWithRuns[] }>("/api/agent/configure"),
    15000,
    [refreshKey],
  );

  const agents = useMemo(() => {
    const list = data?.agents ?? [];
    return list.filter((agent) => {
      const matchesQuery =
        !query ||
        `${agent.name} ${agent.description}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && agent.status === "active") ||
        (statusFilter === "paused" && agent.status === "paused");
      return matchesQuery && matchesStatus;
    });
  }, [data?.agents, query, statusFilter]);

  if (loading && !data) {
    return (
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-72 rounded-xl" />
        ))}
      </div>
    );
  }

  if ((data?.agents?.length ?? 0) === 0) {
    return (
      <EmptyState
        icon={Bot}
        title="No agents yet"
        description="Create your first agent and it will show up here with its schedule, status and run history."
        action={
          <Button className="gap-2" onClick={onCreate}>
            <Plus className="size-4" />
            Create an agent
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your agents…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
        <Button className="gap-2" onClick={onCreate}>
          <Plus className="size-4" />
          New agent
        </Button>
      </div>

      {agents.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No agents match"
          description="Try a different search term or status filter."
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.agentId}
              agent={agent}
              onChanged={onChanged}
              onEdit={onEdit}
              onChat={onChat}
            />
          ))}
        </div>
      )}
    </div>
  );
}
