import type { AgentMetrics, AgentRanking, RefreshResult } from "@/types";
import { computePercentiles } from "./percentile";
import { filterEligible } from "./eligibility";
import { fetchAdmins } from "@/lib/intercom/fetch-admins";
import { aggregateMetricsSlim } from "@/lib/intercom/aggregate-metrics-slim";
import { fetchIncrementalConversations } from "@/lib/intercom/fetch-incremental";
import { cacheConversations, loadCachedConversations, cleanupOldMonths } from "@/lib/intercom/conversation-cache";
import { getMTDRange } from "@/lib/utils/date";
import { prisma } from "@/lib/db/prisma";

const CHANNEL_CONFIG = {
  chat: { sourceType: "conversation", minConversations: 100 },
  email: { sourceType: "email", minConversations: 30 },
} as const;

export type Channel = keyof typeof CHANNEL_CONFIG;

/**
 * Compute rankings from pre-aggregated agent metrics + QA scores.
 * This is the pure ranking logic, separated from data fetching.
 */
export function rankAgents(
  allAgents: AgentMetrics[],
  qaScores?: Map<string, number>,
  minConversations?: number
): AgentRanking[] {
  // Merge QA scores if available
  if (qaScores) {
    for (const agent of allAgents) {
      const qa = qaScores.get(agent.displayName) ?? qaScores.get(agent.intercomAdminId);
      if (qa !== undefined) agent.qaScore = qa;
    }
  }

  const { eligible, ineligible } = filterEligible(allAgents, minConversations);

  // Compute percentiles for each metric among eligible agents
  const p95Percentiles = computePercentiles(
    eligible.map((a) => ({ agentId: a.intercomAdminId, value: a.p95ResponseTimeSeconds })),
    "lower_is_better"
  );
  const ahtPercentiles = computePercentiles(
    eligible.map((a) => ({ agentId: a.intercomAdminId, value: a.avgHandlingTimeSeconds })),
    "lower_is_better"
  );
  const cxPercentiles = computePercentiles(
    eligible.map((a) => ({ agentId: a.intercomAdminId, value: a.cxScorePercent })),
    "higher_is_better"
  );

  // QA percentiles only for agents that have QA scores
  const agentsWithQA = eligible.filter((a) => a.qaScore !== undefined);
  const qaPercentiles = agentsWithQA.length > 0
    ? computePercentiles(
        agentsWithQA.map((a) => ({ agentId: a.intercomAdminId, value: a.qaScore! })),
        "higher_is_better"
      )
    : new Map<string, number>();

  // Composite score weights: FRT 25%, AHT 25%, CX 30%, QA 20%
  // If any KPI is missing, redistribute its weight proportionally across the rest
  const WEIGHTS = { frt: 0.25, aht: 0.25, cx: 0.30, qa: 0.20 };

  const eligibleRankings: AgentRanking[] = eligible.map((agent) => {
    const p95P = p95Percentiles.get(agent.intercomAdminId) ?? 0;
    const ahtP = ahtPercentiles.get(agent.intercomAdminId) ?? 0;
    const cxP = cxPercentiles.get(agent.intercomAdminId) ?? 0;
    const qaP = qaPercentiles.get(agent.intercomAdminId);

    let compositeScore: number;
    if (qaP !== undefined) {
      compositeScore =
        p95P * WEIGHTS.frt + ahtP * WEIGHTS.aht + cxP * WEIGHTS.cx + qaP * WEIGHTS.qa;
    } else {
      // Redistribute QA weight proportionally: FRT/AHT/CX keep their ratios
      const totalWithout = WEIGHTS.frt + WEIGHTS.aht + WEIGHTS.cx;
      compositeScore =
        p95P * (WEIGHTS.frt / totalWithout) +
        ahtP * (WEIGHTS.aht / totalWithout) +
        cxP * (WEIGHTS.cx / totalWithout);
    }

    return {
      ...agent,
      p95ResponsePercentile: p95P,
      ahtPercentile: ahtP,
      cxScorePercentile: cxP,
      qaScorePercentile: qaP,
      compositeScore,
      rank: 0, // assigned after sorting
      isEligible: true,
      isTopFive: false, // assigned after sorting
    };
  });

  // Sort by composite score descending (highest = best)
  // Tie-break: CX Score percentile → AHT percentile → alphabetical
  eligibleRankings.sort((a, b) => {
    if (b.compositeScore !== a.compositeScore)
      return b.compositeScore - a.compositeScore;
    if (b.cxScorePercentile !== a.cxScorePercentile)
      return b.cxScorePercentile - a.cxScorePercentile;
    if (b.ahtPercentile !== a.ahtPercentile)
      return b.ahtPercentile - a.ahtPercentile;
    return a.displayName.localeCompare(b.displayName);
  });

  // Assign ranks
  eligibleRankings.forEach((agent, index) => {
    agent.rank = index + 1;
    agent.isTopFive = agent.rank <= 5;
  });

  // Ineligible agents: no rank, shown at the bottom
  const ineligibleRankings: AgentRanking[] = ineligible.map((agent) => ({
    ...agent,
    p95ResponsePercentile: 0,
    ahtPercentile: 0,
    cxScorePercentile: 0,
    qaScorePercentile: undefined,
    compositeScore: 0,
    rank: 0,
    isEligible: false,
    isTopFive: false,
  }));

  return [...eligibleRankings, ...ineligibleRankings];
}

export interface RefreshOptions {
  channel: Channel;
  qaScores?: Map<string, number>;
}

/**
 * Get the last successful refresh time for a channel in the current month.
 * Returns null if no successful refresh exists (triggers full fetch).
 */
async function getLastRefreshTime(
  channel: string,
  monthStart: Date
): Promise<Date | null> {
  const lastSuccess = await prisma.refreshLog.findFirst({
    where: {
      channel,
      status: "success",
      startedAt: { gte: monthStart },
    },
    orderBy: { startedAt: "desc" },
    select: { completedAt: true },
  });

  return lastSuccess?.completedAt ?? null;
}

/**
 * Format a Date as "YYYY-MM" for cache partitioning.
 */
function toPeriodMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Incremental refresh pipeline:
 *   1. Look up last successful refresh time
 *   2. Fetch only new + updated conversations from Intercom
 *   3. Upsert into cache, clean up stale months
 *   4. Load full cached dataset for the month
 *   5. Aggregate → rank → save (same as before)
 */
export async function refreshRankings(
  options: RefreshOptions
): Promise<RefreshResult> {
  const { channel, qaScores } = options;
  const { sourceType, minConversations } = CHANNEL_CONFIG[channel];
  const { start, end } = getMTDRange();
  const periodMonth = toPeriodMonth(start);
  const snapshotDate = new Date();

  try {
    // Step 1: Determine fetch mode — only go incremental if cache is already populated
    const cacheCount = await prisma.conversationCache.count({
      where: { channel, periodMonth },
    });
    const lastRefreshTime = cacheCount > 0
      ? await getLastRefreshTime(channel, start)
      : null; // empty cache → force full fetch even if RefreshLog has entries
    const modeLabel = lastRefreshTime ? "incremental" : "full";
    if (cacheCount === 0) {
      console.log(`[Refresh] [${channel}] Cache is empty — forcing full fetch to populate`);
    }
    console.log(`[Refresh] [${channel}] [${modeLabel}] Fetching conversations from ${start.toISOString()} to ${end.toISOString()}`);

    // Step 2: Fetch new + updated conversations from Intercom
    const { conversations: freshConversations, fetchMode, pagesFetched } =
      await fetchIncrementalConversations(start, end, sourceType, lastRefreshTime);
    console.log(`[Refresh] [${channel}] [${modeLabel}] Fetched ${freshConversations.length} conversations across ${pagesFetched} pages`);

    // Step 3: Upsert fetched conversations into cache
    await cacheConversations(freshConversations, channel, periodMonth);

    // Step 4: Clean up cache rows from previous months
    await cleanupOldMonths(periodMonth);

    // Step 5: Load the full cached dataset for aggregation
    const allConversations = await loadCachedConversations(channel, periodMonth);

    // Step 6: Fetch admin names
    const admins = await fetchAdmins();

    // Step 7: Aggregate per-agent metrics from full cached dataset
    // Skip burst detection for email — bulk assignments are normal email workflow
    const agentMetrics = aggregateMetricsSlim(allConversations, admins, {
      skipBurstDetection: channel === "email",
    });
    console.log(`[Refresh] [${channel}] [${modeLabel}] Aggregated metrics for ${agentMetrics.length} agents from ${allConversations.length} cached conversations`);

    // Step 8: Compute rankings
    const rankings = rankAgents(agentMetrics, qaScores, minConversations);

    // Step 9: Save to database
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
            snapshotDate,
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
          periodStart: start,
          periodEnd: end,
          snapshotDate,
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

    // Step 10: Log refresh with fetch mode details
    await prisma.refreshLog.create({
      data: {
        startedAt: snapshotDate,
        completedAt: new Date(),
        status: "success",
        channel,
        agentCount: rankings.length,
        ticketCount: allConversations.length,
        fetchMode,
        pagesFetched,
      },
    });

    console.log(`[Refresh] [${channel}] [${modeLabel}] Success: ${rankings.length} agents ranked from ${allConversations.length} conversations (fetched ${freshConversations.length} this run)`);

    return {
      status: "success",
      agentCount: rankings.length,
      ticketCount: allConversations.length,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Refresh] [${channel}] Failed:`, errorMsg);

    await prisma.refreshLog.create({
      data: {
        startedAt: snapshotDate,
        completedAt: new Date(),
        status: "failed",
        channel,
        errorMsg,
      },
    });

    return {
      status: "failed",
      agentCount: 0,
      ticketCount: 0,
      errorMsg,
    };
  }
}
