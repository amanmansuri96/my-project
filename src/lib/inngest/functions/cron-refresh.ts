import { inngest } from "../client";

/**
 * Daily cron: triggers ranking refresh for both channels.
 * Replaces the Vercel cron + /api/cron/refresh pattern.
 */
export const cronRefresh = inngest.createFunction(
  { id: "cron-refresh-rankings" },
  { cron: "0 6 * * *" },
  async ({ step }) => {
    await step.sendEvent("trigger-refresh", [
      { name: "refresh/rankings.requested" as const, data: { channel: "chat" as const } },
      { name: "refresh/rankings.requested" as const, data: { channel: "email" as const } },
    ]);

    return { triggered: ["chat", "email"] };
  }
);
