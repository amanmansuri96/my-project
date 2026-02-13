import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";

export async function GET(request: Request) {
  // Verify cron secret in production
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await inngest.send([
    { name: "refresh/rankings.requested", data: { channel: "chat" } },
    { name: "refresh/rankings.requested", data: { channel: "email" } },
  ]);

  return NextResponse.json({ status: "triggered" });
}
