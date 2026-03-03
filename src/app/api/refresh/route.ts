import { NextResponse } from "next/server";
import { refreshRankings } from "@/lib/ranking/compute-rankings";

export async function POST() {
  const results = [];

  for (const channel of ["chat", "email"] as const) {
    console.log(`[Refresh] Starting ${channel}...`);
    const result = await refreshRankings({ channel });
    results.push({ channel, ...result });
  }

  return NextResponse.json({ results });
}
