import { NextResponse } from "next/server";
import { refreshRankings } from "@/lib/ranking/compute-rankings";

export async function POST() {
  const result = await refreshRankings();
  return NextResponse.json(result, {
    status: result.status === "failed" ? 500 : 200,
  });
}
