"use client";

import type { AgentRanking } from "@/types";
import { formatDuration, formatPercent } from "@/lib/utils/format";
import { RankBadge } from "./rank-badge";
import { MetricCell } from "./metric-cell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function LeaderboardTable({
  rankings,
  lastRefreshed,
  channel = "chat",
  minConversations = 100,
}: {
  rankings: AgentRanking[];
  lastRefreshed: Date | null;
  channel?: string;
  minConversations?: number;
}) {
  const eligible = rankings.filter((r) => r.isEligible);
  const ineligible = rankings.filter((r) => !r.isEligible);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl">Agent Leaderboard</CardTitle>
          {lastRefreshed && (
            <span className="text-sm text-gray-500">
              Last refreshed:{" "}
              {lastRefreshed.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">
          Month-to-date performance rankings across all metrics
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Rank</TableHead>
                <TableHead>Teammate</TableHead>
                <TableHead className="text-center">Conversations</TableHead>
                <TableHead>p95 FRT</TableHead>
                <TableHead>Avg Handling</TableHead>
                <TableHead>CX Score</TableHead>
                <TableHead>QA Score</TableHead>
                <TableHead className="text-right">Composite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eligible.map((agent) => (
                <TableRow key={agent.intercomAdminId}>
                  <TableCell>
                    <RankBadge rank={agent.rank} tier={agent.tier} />
                  </TableCell>
                  <TableCell className="font-medium">
                    <a
                      href={`/dashboard/agent/${agent.intercomAdminId}?channel=${channel}`}
                      className="text-blue-600 hover:underline"
                    >
                      {agent.displayName}
                    </a>
                  </TableCell>
                  <TableCell className="text-center">
                    {agent.conversationCount}
                  </TableCell>
                  <TableCell>
                    <MetricCell
                      rawValue={formatDuration(agent.p95ResponseTimeSeconds)}
                      percentile={agent.p95ResponsePercentile}
                      isEligible={true}
                    />
                  </TableCell>
                  <TableCell>
                    <MetricCell
                      rawValue={formatDuration(agent.avgHandlingTimeSeconds)}
                      percentile={agent.ahtPercentile}
                      isEligible={true}
                    />
                  </TableCell>
                  <TableCell>
                    <MetricCell
                      rawValue={formatPercent(agent.cxScorePercent)}
                      percentile={agent.cxScorePercentile}
                      isEligible={true}
                    />
                  </TableCell>
                  <TableCell>
                    {agent.qaScore !== undefined ? (
                      <MetricCell
                        rawValue={agent.qaScore.toFixed(1)}
                        percentile={agent.qaScorePercentile ?? 0}
                        isEligible={true}
                      />
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-lg font-bold text-gray-900">
                      {agent.compositeScore.toFixed(1)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}

              {ineligible.length > 0 && (
                <>
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Separator className="my-2" />
                      <span className="text-xs text-gray-400">
                        Below minimum {minConversations} conversations — not ranked
                      </span>
                    </TableCell>
                  </TableRow>
                  {ineligible.map((agent) => (
                    <TableRow
                      key={agent.intercomAdminId}
                      className="opacity-50"
                    >
                      <TableCell>
                        <span className="text-sm text-gray-400">-</span>
                      </TableCell>
                      <TableCell className="font-medium text-gray-500">
                        {agent.displayName}
                      </TableCell>
                      <TableCell className="text-center text-gray-500">
                        {agent.conversationCount}
                      </TableCell>
                      <TableCell colSpan={4}>
                        <span className="text-xs text-gray-400">
                          {agent.conversationCount}/{minConversations} conversations
                        </span>
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  ))}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
