import { NextResponse } from "next/server";
import { errorResponse, requireApiUser } from "@/lib/api";
import { withSwr } from "@/lib/swr-cache";
import { llmStatus } from "@/agent/ai/llm";
import { getDashboardSnapshot } from "@/lib/dashboard";

export const runtime = "nodejs";

/**
 * Fast dashboard endpoint — DB queries only. The AI briefing moved to
 * /api/dashboard/briefing so this always answers in milliseconds.
 */
export async function GET() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  try {
    const snapshot = await withSwr(`dashboard:${user.email}`, async () => {
      const data = await getDashboardSnapshot(user.email);
      return { ...data, ai: llmStatus() };
    }, 3_000);
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("[dashboard GET]", error);
    return errorResponse("Internal server error", 500);
  }
}
