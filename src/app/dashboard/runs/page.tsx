import { Suspense } from "react";
import type { Metadata } from "next";
import { RunsPageSkeleton } from "@/components/runs/runs-skeleton";
import { RunsView } from "@/components/runs/runs-view";

export const metadata: Metadata = { title: "Runs" };

export default function RunsPage() {
  return (
    <Suspense fallback={<RunsPageSkeleton />}>
      <RunsView />
    </Suspense>
  );
}
