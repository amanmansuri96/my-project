import { NextResponse } from "next/server";
import { refreshRankings } from "@/lib/ranking/compute-rankings";

/**
 * Cron endpoint — called daily at 1 AM GMT by Railway cron.
 * Refreshes both chat and email rankings directly (no Inngest needed).
 * Protected by CRON_SECRET to prevent unauthorized triggers.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = [];

  for (const channel of ["chat", "email"] as const) {
    console.log(`[Cron] Starting ${channel} refresh...`);
    const result = await refreshRankings({ channel });
    results.push({ channel, ...result });
    console.log(`[Cron] ${channel}: ${result.status}`);
  }

  return NextResponse.json({ results });
}
