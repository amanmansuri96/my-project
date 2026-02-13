import type { IntercomConversation } from "./types";

/**
 * Lightweight conversation representation for Inngest step payloads.
 * Full IntercomConversation is ~2KB; SlimConversation is ~150 bytes.
 * Keeps only the fields that aggregateMetrics actually reads.
 */
export interface SlimConversation {
  /** First teammate admin ID (the agent who first replied) */
  firstTeammateId: string;
  /** Number of teammates on this conversation */
  teammateCount: number;
  /** first_admin_reply_at - last_assignment_at (seconds), null if unavailable */
  frtSeconds: number | null;
  /** Handling time in seconds (null if > 4h cap or missing) */
  handlingTimeSeconds: number | null;
  /** CX Score rating 1-5, null if not rated */
  cxScoreRating: number | null;
}

const MAX_HANDLING_TIME_SECONDS = 4 * 60 * 60;

/**
 * Convert a full Intercom conversation to a slim representation.
 * Returns null if the conversation should be skipped (no teammate, excluded, etc.)
 */
export function toSlimConversation(
  conv: IntercomConversation
): SlimConversation | null {
  const firstTeammate = conv.teammates?.admins?.[0]?.id;
  if (!firstTeammate) return null;

  const stats = conv.statistics;

  // FRT calculation: first_admin_reply_at - last_assignment_at
  let frtSeconds: number | null = null;
  if (stats.first_admin_reply_at && stats.last_assignment_at) {
    frtSeconds = stats.first_admin_reply_at - stats.last_assignment_at;
    if (frtSeconds < 0) frtSeconds = null;
  }

  // Handling time with cap
  let handlingTimeSeconds: number | null = stats.handling_time ?? null;
  if (
    handlingTimeSeconds !== null &&
    handlingTimeSeconds > MAX_HANDLING_TIME_SECONDS
  ) {
    handlingTimeSeconds = null;
  }

  // CX Score from custom_attributes
  const cxRaw = conv.custom_attributes?.["CX Score rating"];
  const cxScoreRating =
    typeof cxRaw === "number" && cxRaw >= 1 && cxRaw <= 5 ? cxRaw : null;

  return {
    firstTeammateId: firstTeammate,
    teammateCount: conv.teammates?.admins?.length ?? 0,
    frtSeconds,
    handlingTimeSeconds,
    cxScoreRating,
  };
}
