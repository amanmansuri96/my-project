import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { formatDuration, formatPercent, formatPercentile } from "@/lib/utils/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const agent = await prisma.agent.findFirst({
    where: { intercomAdminId: id },
  });

  if (!agent) return notFound();

  // Get recent snapshots for trend
  const snapshots = await prisma.rankingSnapshot.findMany({
    where: { agentId: agent.id },
    orderBy: { snapshotDate: "desc" },
    take: 30,
  });

  const latest = snapshots[0];
  if (!latest) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold">{agent.displayName}</h1>
        <p className="text-gray-500 mt-2">No ranking data available yet.</p>
      </div>
    );
  }

  const metrics = [
    {
      label: "p95 First Response Time",
      rawValue: formatDuration(latest.p95ResponseTimeSeconds),
      percentile: latest.p95ResponsePercentile,
      direction: "Lower is better",
    },
    {
      label: "Avg Handling Time",
      rawValue: formatDuration(latest.avgHandlingTimeSeconds),
      percentile: latest.ahtPercentile,
      direction: "Lower is better",
    },
    {
      label: "CX Score",
      rawValue: formatPercent(latest.cxScorePercent),
      percentile: latest.cxScorePercentile,
      direction: "Higher is better",
    },
    {
      label: "QA Score",
      rawValue: latest.qaScore?.toFixed(1) ?? "N/A",
      percentile: latest.qaScorePercentile ?? null,
      direction: "Higher is better",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {agent.displayName}
          </h1>
          {agent.email && (
            <p className="text-gray-500">{agent.email}</p>
          )}
        </div>
        {latest.isEligible && (
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900">
              #{latest.rank}
            </div>
            <Badge variant="outline" className="mt-1">
              Composite: {latest.compositeScore.toFixed(1)}
            </Badge>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">
                {metric.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.rawValue}</div>
              {metric.percentile !== null && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        metric.percentile >= 75
                          ? "bg-green-500"
                          : metric.percentile >= 50
                            ? "bg-yellow-500"
                            : metric.percentile >= 25
                              ? "bg-orange-500"
                              : "bg-red-500"
                      }`}
                      style={{ width: `${metric.percentile}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600">
                    {formatPercentile(metric.percentile)}
                  </span>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">{metric.direction}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rank History</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshots.length <= 1 ? (
            <p className="text-sm text-gray-400">
              Trend data will appear after multiple daily snapshots.
            </p>
          ) : (
            <div className="space-y-1">
              {snapshots.slice(0, 14).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-sm border-b py-1"
                >
                  <span className="text-gray-500">
                    {s.snapshotDate.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <span className="font-medium">
                    #{s.rank} — {s.compositeScore.toFixed(1)}
                  </span>
                  <span className="text-gray-400">
                    {s.conversationCount} convos
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <a
        href="/dashboard"
        className="inline-block text-sm text-blue-600 hover:underline"
      >
        Back to Leaderboard
      </a>
    </div>
  );
}
