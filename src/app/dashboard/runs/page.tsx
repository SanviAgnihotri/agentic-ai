import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { RunsView } from "@/components/runs/runs-view";

export const metadata: Metadata = { title: "Runs" };

export default function RunsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-20 w-full rounded-xl" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      }
    >
      <RunsView />
    </Suspense>
  );
}
