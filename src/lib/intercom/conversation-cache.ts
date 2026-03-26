import { prisma } from "@/lib/db/prisma";
import type { SlimConversation } from "./slim-conversation";

const UPSERT_BATCH_SIZE = 50;

/**
 * Batch upsert slim conversations into the ConversationCache table.
 * Uses individual upserts in batches to stay within SQLite/Turso limits.
 */
export async function cacheConversations(
  conversations: SlimConversation[],
  channel: string,
  periodMonth: string
): Promise<number> {
  let upserted = 0;

  for (let i = 0; i < conversations.length; i += UPSERT_BATCH_SIZE) {
    const batch = conversations.slice(i, i + UPSERT_BATCH_SIZE);

    // Use a transaction per batch to reduce round-trips
    await prisma.$transaction(
      batch.map((conv) =>
        prisma.conversationCache.upsert({
          where: { id: conv.id },
          update: {
            channel,
            periodMonth,
            firstTeammateId: conv.firstTeammateId,
            teammateCount: conv.teammateCount,
            frtSeconds: conv.frtSeconds,
            handlingTimeSeconds: conv.handlingTimeSeconds,
            cxScoreRating: conv.cxScoreRating,
            lastAssignmentAt: conv.lastAssignmentAt,
            cachedAt: new Date(),
          },
          create: {
            id: conv.id,
            channel,
            periodMonth,
            firstTeammateId: conv.firstTeammateId,
            teammateCount: conv.teammateCount,
            frtSeconds: conv.frtSeconds,
            handlingTimeSeconds: conv.handlingTimeSeconds,
            cxScoreRating: conv.cxScoreRating,
            lastAssignmentAt: conv.lastAssignmentAt,
          },
        })
      )
    );

    upserted += batch.length;
  }

  console.log(`[Cache] Upserted ${upserted} conversations for ${channel} ${periodMonth}`);
  return upserted;
}

/**
 * Load all cached conversations for a channel+month, returning them as SlimConversation[].
 */
export async function loadCachedConversations(
  channel: string,
  periodMonth: string
): Promise<SlimConversation[]> {
  const rows = await prisma.conversationCache.findMany({
    where: { channel, periodMonth },
  });

  console.log(`[Cache] Loaded ${rows.length} cached conversations for ${channel} ${periodMonth}`);

  return rows.map((row) => ({
    id: row.id,
    firstTeammateId: row.firstTeammateId,
    teammateCount: row.teammateCount,
    frtSeconds: row.frtSeconds,
    handlingTimeSeconds: row.handlingTimeSeconds,
    cxScoreRating: row.cxScoreRating,
    lastAssignmentAt: row.lastAssignmentAt,
  }));
}

/**
 * Delete cached conversations from months other than the current one.
 * Prevents unbounded cache growth across month boundaries.
 */
export async function cleanupOldMonths(currentMonth: string): Promise<number> {
  const result = await prisma.conversationCache.deleteMany({
    where: {
      periodMonth: { not: currentMonth },
    },
  });

  if (result.count > 0) {
    console.log(`[Cache] Cleaned up ${result.count} rows from old months (keeping ${currentMonth})`);
  }

  return result.count;
}
