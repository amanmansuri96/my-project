import { NextResponse } from "next/server";
import { refreshRankings } from "@/lib/ranking/compute-rankings";

export async function GET(request: Request) {
  // Verify cron secret in production
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshRankings();
  return NextResponse.json(result, {
    status: result.status === "failed" ? 500 : 200,
  });
}
