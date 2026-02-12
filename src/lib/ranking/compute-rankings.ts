import type { AgentMetrics, AgentRanking, Tier, RefreshResult } from "@/types";
import { computePercentiles } from "./percentile";
import { filterEligible } from "./eligibility";
import { fetchCustomerTickets } from "@/lib/intercom/fetch-tickets";
import { fetchConversationsBatch } from "@/lib/intercom/fetch-conversations";
import { fetchAdmins } from "@/lib/intercom/fetch-admins";
import { aggregateMetrics } from "@/lib/intercom/aggregate-metrics";
import { getMTDRange } from "@/lib/utils/date";
import { prisma } from "@/lib/db/prisma";

function getTier(rank: number, totalEligible: number): Tier {
  if (totalEligible === 0) return { name: "Rising", color: "green" };
  const percentile = ((totalEligible - rank) / totalEligible) * 100;
  if (percentile >= 90) return { name: "Diamond", color: "blue" };
  if (percentile >= 75) return { name: "Gold", color: "yellow" };
  if (percentile >= 50) return { name: "Silver", color: "gray" };
  if (percentile >= 25) return { name: "Bronze", color: "orange" };
  return { name: "Rising", color: "green" };
}

/**
 * Compute rankings from pre-aggregated agent metrics + QA scores.
 * This is the pure ranking logic, separated from data fetching.
 */
export function rankAgents(
  allAgents: AgentMetrics[],
  qaScores?: Map<string, number>
): AgentRanking[] {
  // Merge QA scores if available
  if (qaScores) {
    for (const agent of allAgents) {
      const qa = qaScores.get(agent.displayName) ?? qaScores.get(agent.intercomAdminId);
      if (qa !== undefined) agent.qaScore = qa;
    }
  }

  const { eligible, ineligible } = filterEligible(allAgents);

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

  // Compute composite score: equal weight (25% each)
  // If QA score is missing for an agent, weight the other 3 equally (33.3% each)
  const eligibleRankings: AgentRanking[] = eligible.map((agent) => {
    const p95P = p95Percentiles.get(agent.intercomAdminId) ?? 0;
    const ahtP = ahtPercentiles.get(agent.intercomAdminId) ?? 0;
    const cxP = cxPercentiles.get(agent.intercomAdminId) ?? 0;
    const qaP = qaPercentiles.get(agent.intercomAdminId);

    let compositeScore: number;
    if (qaP !== undefined) {
      compositeScore = p95P * 0.25 + ahtP * 0.25 + cxP * 0.25 + qaP * 0.25;
    } else {
      compositeScore = (p95P + ahtP + cxP) / 3;
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
      tier: { name: "Rising" as const, color: "green" },
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

  // Assign ranks and tiers
  const totalEligible = eligibleRankings.length;
  eligibleRankings.forEach((agent, index) => {
    agent.rank = index + 1;
    agent.tier = getTier(agent.rank, totalEligible);
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
    tier: { name: "Rising" as const, color: "green" },
  }));

  return [...eligibleRankings, ...ineligibleRankings];
}

/**
 * Full refresh pipeline: fetch data → compute → save to DB.
 */
export async function refreshRankings(
  qaScores?: Map<string, number>
): Promise<RefreshResult> {
  const { start, end } = getMTDRange();
  const snapshotDate = new Date();

  try {
    // Step 1: Fetch customer tickets
    const tickets = await fetchCustomerTickets(start, end);

    // Step 2: Fetch linked conversations
    const conversationIds = tickets
      .map((t) => t.conversation_id)
      .filter((id): id is string => id !== null);
    const conversations = await fetchConversationsBatch(conversationIds);

    // Step 3: Fetch admin names
    const admins = await fetchAdmins();

    // Step 4: Aggregate per-agent metrics
    const agentMetrics = aggregateMetrics(tickets, conversations, admins);

    // Step 5: Compute rankings
    const rankings = rankAgents(agentMetrics, qaScores);

    // Step 6: Save to database
    for (const ranking of rankings) {
      // Upsert agent
      const agent = await prisma.agent.upsert({
        where: { intercomAdminId: ranking.intercomAdminId },
        update: { displayName: ranking.displayName, email: ranking.email },
        create: {
          intercomAdminId: ranking.intercomAdminId,
          displayName: ranking.displayName,
          email: ranking.email,
        },
      });

      // Create ranking snapshot
      await prisma.rankingSnapshot.upsert({
        where: {
          agentId_snapshotDate: {
            agentId: agent.id,
            snapshotDate,
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

    // Log refresh
    await prisma.refreshLog.create({
      data: {
        startedAt: snapshotDate,
        completedAt: new Date(),
        status: "success",
        agentCount: rankings.length,
        ticketCount: tickets.length,
      },
    });

    return {
      status: "success",
      agentCount: rankings.length,
      ticketCount: tickets.length,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    await prisma.refreshLog.create({
      data: {
        startedAt: snapshotDate,
        completedAt: new Date(),
        status: "failed",
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
