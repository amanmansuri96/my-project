import type { IntercomConversation, IntercomTicket, IntercomAdmin } from "./types";
import type { AgentMetrics } from "@/types";

interface ConversationData {
  frtSeconds: number | null; // first_admin_reply_at - first_assignment_at
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

  // FRT (bot inbox excluded) = first_admin_reply_at - first_assignment_at
  let frtSeconds: number | null = null;
  if (stats.first_admin_reply_at && stats.first_assignment_at) {
    frtSeconds = stats.first_admin_reply_at - stats.first_assignment_at;
    if (frtSeconds < 0) frtSeconds = null; // Defensive: skip invalid data
  }

  // CX Score from custom_attributes
  const cxRaw = conv.custom_attributes?.["CX Score rating"];
  const cxScoreRating =
    typeof cxRaw === "number" && cxRaw >= 1 && cxRaw <= 5 ? cxRaw : null;

  return {
    frtSeconds,
    handlingTimeSeconds: stats.handling_time ?? null,
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
 * Aggregate per-agent metrics from tickets and their linked conversations.
 *
 * @param tickets - Customer tickets from Intercom
 * @param conversations - Map of conversationId → conversation object
 * @param admins - Map of adminId → admin object
 * @returns Per-agent aggregated metrics
 */
export function aggregateMetrics(
  tickets: IntercomTicket[],
  conversations: Map<string, IntercomConversation>,
  admins: Map<string, IntercomAdmin>
): AgentMetrics[] {
  // Group ticket data by agent
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

  for (const ticket of tickets) {
    const agentId = ticket.admin_assignee_id;
    if (!agentId || !ticket.conversation_id) continue;

    const conv = conversations.get(ticket.conversation_id);
    if (!conv) continue;

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

    if (convData.handlingTimeSeconds !== null) {
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
