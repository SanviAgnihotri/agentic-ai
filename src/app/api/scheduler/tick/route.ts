import { NextResponse } from "next/server";
import { tick } from "@/agent/engine/scheduler";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Scheduler tick endpoint.
 *
 * Called by the built-in scheduler every minute, and safe to call from Vercel
 * Cron (`vercel.json`) or any external pinger. If CRON_SECRET is set, requests
 * must present `Authorization: Bearer <CRON_SECRET>`.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization");
    const url = new URL(request.url);
    const querySecret = url.searchParams.get("secret");
    if (header !== `Bearer ${secret}` && querySecret !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  try {
    const result = await tick();
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (error) {
    console.error("[scheduler/tick]", error);
    return NextResponse.json({ error: "Tick failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
