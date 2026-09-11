import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { llmStatus } from "@/agent/ai/llm";
import { getIntegrationsOverview } from "@/agent/integrations";
import { getDashboardSnapshot } from "@/lib/dashboard";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { Skeleton } from "@/components/ui/skeleton";

// The snapshot is user-specific, so this renders per request — but it only
// waits on fast DB queries. The AI briefing card fills in asynchronously from
// /api/dashboard/briefing.
export default async function DashboardPage() {
  const user = await requireUser();
  // Warm the integrations overview cache (a Composio round-trip) in the
  // background so clicking Integrations never blocks on its first network
  // call.
  void getIntegrationsOverview(user.email).catch(() => {});

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardSnapshot email={user.email} />
    </Suspense>
  );
}

async function DashboardSnapshot({ email }: { email: string }) {
  const snapshot = await getDashboardSnapshot(email);
  return <DashboardView initialData={{ ...snapshot, ai: llmStatus() }} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
