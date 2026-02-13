import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";

export async function POST() {
  await inngest.send([
    { name: "refresh/rankings.requested", data: { channel: "chat" } },
    { name: "refresh/rankings.requested", data: { channel: "email" } },
  ]);

  return NextResponse.json({ status: "triggered" });
}
