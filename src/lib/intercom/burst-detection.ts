/**
 * Detect bulk-assigned conversations using assignment burst detection.
 *
 * When ops manually assigns 20-30 chats to an agent at once, those
 * conversations cluster in time (all sharing a similar last_assignment_at).
 * Round-robin never produces this pattern — assignments trickle in 1-2 at a time.
 *
 * Logic: for each agent, if more than 5 conversations (i.e. 6+) were assigned
 * within a 10-minute window, all conversations in that window are flagged.
 *
 * Flagged conversations are excluded from FRT and AHT calculations but still
 * count toward volume (eligibility) and CX score.
 */

// Assignments within the window must EXCEED this number to trigger burst detection
// i.e. 6+ conversations in the window = bulk-assigned
const BURST_THRESHOLD = 5;

// Sliding window size in seconds (10 minutes)
const BURST_WINDOW_SECONDS = 10 * 60;

interface AssignmentRecord {
  conversationId: string;
  agentId: string;
  lastAssignmentAt: number; // Unix timestamp
}

/**
 * Given a list of assignment records, return a Set of conversation IDs
 * that were part of a bulk-assignment burst.
 */
export function detectBurstAssignments(
  records: AssignmentRecord[]
): Set<string> {
  const bulkConversationIds = new Set<string>();

  // Group by agent
  const byAgent = new Map<string, AssignmentRecord[]>();
  for (const rec of records) {
    const group = byAgent.get(rec.agentId) ?? [];
    group.push(rec);
    byAgent.set(rec.agentId, group);
  }

  for (const [, agentRecords] of byAgent) {
    if (agentRecords.length <= BURST_THRESHOLD) continue;

    // Sort by assignment time
    agentRecords.sort((a, b) => a.lastAssignmentAt - b.lastAssignmentAt);

    // Sliding window: find clusters of BURST_THRESHOLD+ within BURST_WINDOW_SECONDS
    let windowStart = 0;
    for (let windowEnd = 0; windowEnd < agentRecords.length; windowEnd++) {
      // Shrink window from the left while it exceeds the time limit
      while (
        agentRecords[windowEnd].lastAssignmentAt -
          agentRecords[windowStart].lastAssignmentAt >
        BURST_WINDOW_SECONDS
      ) {
        windowStart++;
      }

      // If the window contains enough assignments, flag all of them
      const windowSize = windowEnd - windowStart + 1;
      if (windowSize > BURST_THRESHOLD) {
        for (let i = windowStart; i <= windowEnd; i++) {
          bulkConversationIds.add(agentRecords[i].conversationId);
        }
      }
    }
  }

  if (bulkConversationIds.size > 0) {
    console.log(
      `[BurstDetection] Flagged ${bulkConversationIds.size} conversations as bulk-assigned`
    );
  }

  return bulkConversationIds;
}
