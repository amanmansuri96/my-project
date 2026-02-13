import { inngest } from "../client";
import { fetchConversationBatch } from "@/lib/intercom/fetch-conversations";
import { fetchAdmins } from "@/lib/intercom/fetch-admins";
import { toSlimConversation } from "@/lib/intercom/slim-conversation";
import type { SlimConversation } from "@/lib/intercom/slim-conversation";
import type { IntercomAdmin } from "@/lib/intercom/types";
import { aggregateMetricsSlim } from "@/lib/intercom/aggregate-metrics-slim";
import { rankAgents } from "@/lib/ranking/compute-rankings";
import { prisma } from "@/lib/db/prisma";
import { getMTDRange } from "@/lib/utils/date";

const CHANNEL_CONFIG = {
  chat: { sourceType: "conversation", minConversations: 100 },
  email: { sourceType: "email", minConversations: 30 },
} as const;

const PAGES_PER_BATCH = 12;

/**
 * Core Inngest step function for refreshing rankings.
 *
 * Breaks the long-running Intercom fetch into batched steps (12 pages each,
 * ~4 min per step) so each step fits within Vercel's 5-min function limit.
 *
 * Steps:
 *   1. init — capture snapshotDate
 *   2. fetch-conversations-batch-N — loop, 12 pages per step
 *   3. fetch-admins — single step
 *   4. compute-rankings — aggregate + rank
 *   5. save-to-database — upsert agents, snapshots, refresh log
 */
export const refreshRankings = inngest.createFunction(
  {
    id: "refresh-rankings",
    retries: 2,
    concurrency: [{ key: "event.data.channel", limit: 1 }],
  },
  { event: "refresh/rankings.requested" },
  async ({ event, step }) => {
    const channel = event.data.channel as "chat" | "email";
    const qaScoresRecord = event.data.qaScores as Record<string, number> | undefined;
    const { sourceType, minConversations } = CHANNEL_CONFIG[channel];

    // Step 1: Capture snapshot date (prevents drift across retries)
    const { snapshotDate, start, end } = await step.run("init", () => {
      const { start, end } = getMTDRange();
      return {
        snapshotDate: new Date().toISOString(),
        start: start.toISOString(),
        end: end.toISOString(),
      };
    });

    // Step 2: Fetch conversations in batched steps (12 pages each, ~4 min per step).
    // Each step is independently timed — if batch 5 fails, batches 1-4 are memoized
    // and won't re-fetch from Intercom on retry.
    const allConversations: SlimConversation[] = [];
    let cursor: string | undefined;
    let batchIndex = 0;

    do {
      const batchCursor = cursor; // capture for closure
      const batch = await step.run(
        `fetch-conversations-batch-${batchIndex}`,
        async () => {
          const { conversations, nextCursor } = await fetchConversationBatch(
            new Date(start),
            new Date(end),
            sourceType,
            batchCursor,
            PAGES_PER_BATCH
          );

          const slim = conversations
            .map(toSlimConversation)
            .filter((c): c is SlimConversation => c !== null);

          return { slimConversations: slim, nextCursor };
        }
      );

      allConversations.push(...batch.slimConversations);
      cursor = batch.nextCursor;
      batchIndex++;
    } while (cursor);

    // Step 3: Fetch admins
    const adminEntries = await step.run("fetch-admins", async () => {
      const admins = await fetchAdmins();
      return Array.from(admins.entries());
    });
    const admins = new Map<string, IntercomAdmin>(adminEntries);

    // Step 4: Compute rankings
    const rankings = await step.run("compute-rankings", () => {
      const agentMetrics = aggregateMetricsSlim(allConversations, admins);
      console.log(
        `[Refresh] [${channel}] Aggregated metrics for ${agentMetrics.length} agents from ${allConversations.length} conversations`
      );

      const qaScores = qaScoresRecord
        ? new Map(Object.entries(qaScoresRecord))
        : undefined;

      return rankAgents(agentMetrics, qaScores, minConversations);
    });

    // Step 5: Save to database
    await step.run("save-to-database", async () => {
      const snapDate = new Date(snapshotDate);
      const periodStart = new Date(start);
      const periodEnd = new Date(end);

      for (const ranking of rankings) {
        const agent = await prisma.agent.upsert({
          where: { intercomAdminId: ranking.intercomAdminId },
          update: { displayName: ranking.displayName, email: ranking.email },
          create: {
            intercomAdminId: ranking.intercomAdminId,
            displayName: ranking.displayName,
            email: ranking.email,
          },
        });

        await prisma.rankingSnapshot.upsert({
          where: {
            agentId_snapshotDate_channel: {
              agentId: agent.id,
              snapshotDate: snapDate,
              channel,
            },
          },
          update: {
            conversationCount: ranking.conversationCount,
            p95ResponseTimeSeconds: ranking.p95ResponseTimeSeconds,
            avgHandlingTimeSeconds: ranking.avgHandlingTimeSeconds,
            cxScorePercent: ranking.cxScorePercent,
            qaScore: ranking.qaScore ?? null,
            p95ResponsePercentile: ranking.p95ResponsePercentile,
            ahtPercentile: ranking.ahtPercentile,
            cxScorePercentile: ranking.cxScorePercentile,
            qaScorePercentile: ranking.qaScorePercentile ?? null,
            compositeScore: ranking.compositeScore,
            rank: ranking.rank,
            isEligible: ranking.isEligible,
          },
          create: {
            agentId: agent.id,
            periodStart,
            periodEnd,
            snapshotDate: snapDate,
            channel,
            conversationCount: ranking.conversationCount,
            p95ResponseTimeSeconds: ranking.p95ResponseTimeSeconds,
            avgHandlingTimeSeconds: ranking.avgHandlingTimeSeconds,
            cxScorePercent: ranking.cxScorePercent,
            qaScore: ranking.qaScore ?? null,
            p95ResponsePercentile: ranking.p95ResponsePercentile,
            ahtPercentile: ranking.ahtPercentile,
            cxScorePercentile: ranking.cxScorePercentile,
            qaScorePercentile: ranking.qaScorePercentile ?? null,
            compositeScore: ranking.compositeScore,
            rank: ranking.rank,
            isEligible: ranking.isEligible,
          },
        });
      }

      await prisma.refreshLog.create({
        data: {
          startedAt: snapDate,
          completedAt: new Date(),
          status: "success",
          channel,
          agentCount: rankings.length,
          ticketCount: allConversations.length,
        },
      });

      console.log(
        `[Refresh] [${channel}] Saved ${rankings.length} agents, ${allConversations.length} conversations`
      );
    });

    return {
      channel,
      agentCount: rankings.length,
      conversationCount: allConversations.length,
    };
  }
);
