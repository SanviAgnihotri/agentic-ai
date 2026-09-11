import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RunDetail } from "@/components/runs/run-detail";

export const metadata: Metadata = { title: "Run detail" };

export default async function RunDetailPage({
  params,
}: PageProps<"/dashboard/runs/[runId]">) {
  const { runId } = await params;
  const id = Number(runId);
  if (!Number.isFinite(id)) notFound();
  return <RunDetail runId={id} />;
}
