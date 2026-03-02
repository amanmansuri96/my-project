import { NextResponse } from "next/server";
import { refreshRankings } from "@/lib/ranking/compute-rankings";
import type { Channel } from "@/lib/ranking/compute-rankings";

/**
 * Direct refresh route — bypasses Inngest for local development.
 * Runs the full pipeline synchronously: fetch → aggregate → rank → save.
 *
 * Usage:
 *   POST /api/refresh-direct              (refreshes both chat + email)
 *   POST /api/refresh-direct?channel=chat  (refreshes chat only)
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelParam = searchParams.get("channel");

  const channels: Channel[] =
    channelParam === "chat" || channelParam === "email"
      ? [channelParam]
      : ["chat", "email"];

  const results = [];

  for (const channel of channels) {
    console.log(`[Direct Refresh] Starting ${channel}...`);
    const result = await refreshRankings({ channel });
    results.push({ channel, ...result });
    console.log(
      `[Direct Refresh] ${channel}: ${result.status} — ${result.agentCount} agents, ${result.ticketCount} conversations`
    );
  }

  return NextResponse.json({ results });
}
