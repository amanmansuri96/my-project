import { prisma } from "@/lib/db/prisma";
import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import type { AgentRanking, Tier } from "@/types";
import { RefreshButton } from "@/components/leaderboard/refresh-button";
import Link from "next/link";

function getTierFromRank(rank: number, totalEligible: number): Tier {
  if (totalEligible === 0) return { name: "Rising", color: "green" };
  const percentile = ((totalEligible - rank) / totalEligible) * 100;
  if (percentile >= 90) return { name: "Diamond", color: "blue" };
  if (percentile >= 75) return { name: "Gold", color: "yellow" };
  if (percentile >= 50) return { name: "Silver", color: "gray" };
  if (percentile >= 25) return { name: "Bronze", color: "orange" };
  return { name: "Rising", color: "green" };
}

const CHANNEL_CONFIG = {
  chat: { label: "Chat", minConversations: 100 },
  email: { label: "Email", minConversations: 30 },
} as const;

type Channel = keyof typeof CHANNEL_CONFIG;

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>;
}) {
  const { channel: rawChannel } = await searchParams;
  const channel: Channel =
    rawChannel === "email" ? "email" : "chat";
  const { label, minConversations } = CHANNEL_CONFIG[channel];

  // Get latest snapshot date for this channel
  const latestSnapshot = await prisma.rankingSnapshot.findFirst({
    where: { channel },
    orderBy: { snapshotDate: "desc" },
    select: { snapshotDate: true },
  });

  if (!latestSnapshot) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <ChannelToggle active={channel} />
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No {label.toLowerCase()} ranking data yet
          </h2>
          <p className="text-gray-500 mb-6">
            Trigger a refresh to pull data from Intercom and compute rankings.
          </p>
          <RefreshButton />
        </div>
      </div>
    );
  }

  // Fetch all snapshots for the latest date + channel
  const snapshots = await prisma.rankingSnapshot.findMany({
    where: { snapshotDate: latestSnapshot.snapshotDate, channel },
    include: { agent: true },
    orderBy: [{ isEligible: "desc" }, { rank: "asc" }],
  });

  const eligibleCount = snapshots.filter((s) => s.isEligible).length;

  const rankings: AgentRanking[] = snapshots.map((s) => ({
    intercomAdminId: s.agent.intercomAdminId,
    displayName: s.agent.displayName,
    email: s.agent.email ?? undefined,
    conversationCount: s.conversationCount,
    p95ResponseTimeSeconds: s.p95ResponseTimeSeconds,
    avgHandlingTimeSeconds: s.avgHandlingTimeSeconds,
    cxScorePercent: s.cxScorePercent,
    qaScore: s.qaScore ?? undefined,
    p95ResponsePercentile: s.p95ResponsePercentile,
    ahtPercentile: s.ahtPercentile,
    cxScorePercentile: s.cxScorePercentile,
    qaScorePercentile: s.qaScorePercentile ?? undefined,
    compositeScore: s.compositeScore,
    rank: s.rank,
    isEligible: s.isEligible,
    tier: s.isEligible
      ? getTierFromRank(s.rank, eligibleCount)
      : { name: "Rising", color: "green" },
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agent Ranker</h1>
          <p className="text-gray-500">
            Aspora CX Team Performance — Month to Date
          </p>
        </div>
        <RefreshButton />
      </div>
      <ChannelToggle active={channel} />
      <LeaderboardTable
        rankings={rankings}
        lastRefreshed={latestSnapshot.snapshotDate}
        channel={channel}
        minConversations={minConversations}
      />
    </div>
  );
}

function ChannelToggle({ active }: { active: Channel }) {
  return (
    <div className="flex gap-2 mb-4">
      {(Object.keys(CHANNEL_CONFIG) as Channel[]).map((ch) => (
        <Link
          key={ch}
          href={`/dashboard?channel=${ch}`}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            active === ch
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {CHANNEL_CONFIG[ch].label}
        </Link>
      ))}
    </div>
  );
}
