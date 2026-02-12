import { NextResponse } from "next/server";
import { parseQAScoresCSV, qaScoresToMap } from "@/lib/anthropod/client";
import { refreshRankings } from "@/lib/ranking/compute-rankings";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const csvContent = await file.text();
    const entries = parseQAScoresCSV(csvContent);

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "No valid QA scores found in CSV" },
        { status: 400 }
      );
    }

    const qaScores = qaScoresToMap(entries);

    // Refresh rankings with the uploaded QA scores
    const result = await refreshRankings(qaScores);

    return NextResponse.json({
      ...result,
      qaScoresLoaded: entries.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
