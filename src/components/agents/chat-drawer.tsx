"use client";

import { Bot } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/shared/status-badge";
import { AgentChat } from "./agent-chat";
import type { AgentWithRuns } from "./agent-card";

export function ChatDrawer({
  agent,
  open,
  onOpenChange,
}: {
  agent: AgentWithRuns | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border/70 px-5 py-4">
          <SheetTitle className="flex items-center gap-3">
            <Avatar className="size-9 rounded-xl border border-border">
              <AvatarImage src={agent?.agentImage ?? undefined} alt={agent?.name ?? "Agent"} />
              <AvatarFallback className="rounded-md bg-muted text-muted-foreground">
                <Bot className="size-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <span className="block truncate text-sm font-semibold">{agent?.name}</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Chat with your agent
              </span>
            </div>
            {agent && <StatusBadge status={agent.status} kind="agent" />}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Ask this agent about its configuration, schedule or latest results.
          </SheetDescription>
        </SheetHeader>
        {agent && <AgentChat agent={agent} className="min-h-0 flex-1 px-5" compact />}
      </SheetContent>
    </Sheet>
  );
}
