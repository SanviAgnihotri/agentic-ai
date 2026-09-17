import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading states for the runs list.
 *
 * Per DESIGN.md ("skeletons match the final layout, not spinners") these mirror
 * the real run-card anatomy — avatar, title + status/trigger badges, preview
 * line, timestamp column, chevron — so the list never jumps when data lands.
 */

export function RunRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading runs…</span>
      {Array.from({ length: rows }).map((_, index) => (
        <Card key={index} className="border-border/70">
          <CardContent className="flex items-center gap-4 p-4">
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-4 w-3/5" />
            </div>
            <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Skeleton className="size-4 shrink-0 rounded-sm" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Full-page fallback for the route-level Suspense boundary. */
export function RunsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Skeleton className="h-9 w-72 rounded-lg" />
          <Skeleton className="h-9 min-w-48 flex-1 rounded-lg" />
          <Skeleton className="h-9 w-52 rounded-lg" />
        </CardContent>
      </Card>
      <RunRowsSkeleton />
    </div>
  );
}
