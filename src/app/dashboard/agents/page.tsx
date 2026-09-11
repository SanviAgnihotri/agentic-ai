import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentsView } from "@/components/agents/agents-view";

export const metadata: Metadata = { title: "Agents" };

export default function AgentsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="mx-auto h-11 w-72 rounded-full" />
          <Skeleton className="mx-auto h-64 w-full max-w-3xl rounded-xl" />
        </div>
      }
    >
      <AgentsView />
    </Suspense>
  );
}
