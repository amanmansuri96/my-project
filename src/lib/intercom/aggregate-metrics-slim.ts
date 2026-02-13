import type { SlimConversation } from "./slim-conversation";
import type { IntercomAdmin } from "./types";
import type { AgentMetrics } from "@/types";

// Same exclusion list as aggregate-metrics.ts
const EXCLUDED_ADMIN_IDS = new Set([
  "8771159", // Help -
  "8915493", // Jagdish Prabhu
  "8831788", // Rintol Subash
  "8833526", // Nisha Prakash
  "8833695", // Usha P
  "8833161", // Praveen Kumar
  "8832131", // Shanmukh Repalle
  "8835496", // Sadiq Muhammed
]);

function computeP95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Aggregate per-agent metrics from slim conversations.
 * Same logic as aggregateMetrics() but works with SlimConversation[].
 */
export function aggregateMetricsSlim(
  conversations: SlimConversation[],
  admins: Map<string, IntercomAdmin>
): AgentMetrics[] {
  const agentData = new Map<
    string,
    {
      frtValues: number[];
      handlingTimes: number[];
      cxPositive: number;
      cxTotal: number;
      conversationCount: number;
    }
  >();

  for (const conv of conversations) {
    if (EXCLUDED_ADMIN_IDS.has(conv.firstTeammateId)) continue;

    const agentId = conv.firstTeammateId;

    if (!agentData.has(agentId)) {
      agentData.set(agentId, {
        frtValues: [],
        handlingTimes: [],
        cxPositive: 0,
        cxTotal: 0,
        conversationCount: 0,
      });
    }

    const data = agentData.get(agentId)!;
    data.conversationCount++;

    if (conv.frtSeconds !== null) {
      data.frtValues.push(conv.frtSeconds);
    }

    // Only single-teammate conversations for handling time
    if (conv.handlingTimeSeconds !== null && conv.teammateCount === 1) {
      data.handlingTimes.push(conv.handlingTimeSeconds);
    }

    if (conv.cxScoreRating !== null) {
      data.cxTotal++;
      if (conv.cxScoreRating >= 4) {
        data.cxPositive++;
      }
    }
  }

  const results: AgentMetrics[] = [];

  for (const [agentId, data] of agentData) {
    const admin = admins.get(agentId);
    const avgHandling =
      data.handlingTimes.length > 0
        ? data.handlingTimes.reduce((a, b) => a + b, 0) /
          data.handlingTimes.length
        : 0;

    const cxScorePercent =
      data.cxTotal > 0 ? (data.cxPositive / data.cxTotal) * 100 : 0;

    results.push({
      intercomAdminId: agentId,
      displayName: admin?.name ?? `Agent ${agentId}`,
      email: admin?.email,
      conversationCount: data.conversationCount,
      p95ResponseTimeSeconds: computeP95(data.frtValues),
      avgHandlingTimeSeconds: avgHandling,
      cxScorePercent,
    });
  }

  return results;
}
