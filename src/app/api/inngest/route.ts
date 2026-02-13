import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { refreshRankings, cronRefresh } from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [refreshRankings, cronRefresh],
});
