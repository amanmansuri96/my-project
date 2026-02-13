import { NextResponse } from "next/server";
import { parseQAScoresCSV, qaScoresToMap } from "@/lib/anthropod/client";
import { inngest } from "@/lib/inngest/client";

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

    // Convert Map to plain object for JSON serialization in Inngest events
    const qaScoresRecord = Object.fromEntries(qaScores);

    await inngest.send([
      {
        name: "refresh/rankings.requested",
        data: { channel: "chat", qaScores: qaScoresRecord },
      },
      {
        name: "refresh/rankings.requested",
        data: { channel: "email", qaScores: qaScoresRecord },
      },
    ]);

    return NextResponse.json({
      status: "triggered",
      qaScoresLoaded: entries.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
