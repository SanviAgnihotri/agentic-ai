import type { Metadata } from "next";
import { AgentDetailView } from "@/components/agents/agent-detail-view";

export const metadata: Metadata = { title: "Agent" };

export default async function AgentDetailPage({
  params,
}: PageProps<"/dashboard/agents/[agentId]">) {
  const { agentId } = await params;
  return <AgentDetailView agentId={agentId} />;
}
