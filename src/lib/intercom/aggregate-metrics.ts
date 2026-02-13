import type { IntercomConversation, IntercomAdmin } from "./types";
import type { AgentMetrics } from "@/types";

// Max reasonable handling time: 4 hours. Anything above is likely a
// still-open conversation or data anomaly and would skew averages.
const MAX_HANDLING_TIME_SECONDS = 4 * 60 * 60;

// Admin IDs to exclude from rankings (bots, system accounts, non-agents)
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

interface ConversationData {
  frtSeconds: number | null; // first_admin_reply_at - last_assignment_at
  handlingTimeSeconds: number | null;
  cxScoreRating: number | null; // 1-5 from custom_attributes
}

/**
 * Extract metric data from a conversation object.
 */
function extractConversationData(
  conv: IntercomConversation
): ConversationData {
  const stats = conv.statistics;

  // FRT (bot inbox excluded) = first_admin_reply_at - last_assignment_at
  // last_assignment_at = when the conversation was assigned to the human teammate
  // (first_assignment_at is the bot's auto-assignment, which is too early)
  let frtSeconds: number | null = null;
  if (stats.first_admin_reply_at && stats.last_assignment_at) {
    frtSeconds = stats.first_admin_reply_at - stats.last_assignment_at;
    if (frtSeconds < 0) frtSeconds = null; // Defensive: skip if reply before assignment (reassigned convos)
  }

  // Handling time: cap at MAX to exclude still-open or anomalous conversations
  let handlingTimeSeconds: number | null = stats.handling_time ?? null;
  if (handlingTimeSeconds !== null && handlingTimeSeconds > MAX_HANDLING_TIME_SECONDS) {
    handlingTimeSeconds = null; // Exclude from average
  }

  // CX Score from custom_attributes
  const cxRaw = conv.custom_attributes?.["CX Score rating"];
  const cxScoreRating =
    typeof cxRaw === "number" && cxRaw >= 1 && cxRaw <= 5 ? cxRaw : null;

  return {
    frtSeconds,
    handlingTimeSeconds,
    cxScoreRating,
  };
}

/**
 * Compute the 95th percentile of a sorted array of numbers.
 */
function computeP95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Aggregate per-agent metrics from customer conversations.
 *
 * @param conversations - Customer conversations (already filtered for "Customer ticket" category)
 * @param admins - Map of adminId (string) → admin object
 * @returns Per-agent aggregated metrics
 */
export function aggregateMetrics(
  conversations: IntercomConversation[],
  admins: Map<string, IntercomAdmin>
): AgentMetrics[] {
  // Group conversation data by agent (admin_assignee_id is a number)
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
    // Attribute conversation to the first teammate (first admin who replied),
    // not admin_assignee_id which reflects the current assignee after reassignments
    const firstTeammate = conv.teammates?.admins?.[0]?.id;
    if (!firstTeammate) continue;
    if (EXCLUDED_ADMIN_IDS.has(firstTeammate)) continue;

    const agentId = firstTeammate;
    const teammateCount = conv.teammates?.admins?.length ?? 0;

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

    const convData = extractConversationData(conv);

    if (convData.frtSeconds !== null) {
      data.frtValues.push(convData.frtSeconds);
    }

    // Only use handling_time for single-teammate conversations where the
    // full handling_time IS that teammate's handling time.
    // For multi-teammate conversations, handling_time is the total across
    // all agents and can't be accurately attributed to one teammate.
    if (convData.handlingTimeSeconds !== null && teammateCount === 1) {
      data.handlingTimes.push(convData.handlingTimeSeconds);
    }

    if (convData.cxScoreRating !== null) {
      data.cxTotal++;
      if (convData.cxScoreRating >= 4) {
        data.cxPositive++;
      }
    }
  }

  // Convert to AgentMetrics
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
