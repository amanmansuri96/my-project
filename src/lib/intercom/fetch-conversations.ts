import { intercomFetch } from "./client";
import type { IntercomConversation } from "./types";

const CONCURRENCY_LIMIT = 5;

/**
 * Fetch a single conversation by ID.
 */
async function fetchConversation(
  conversationId: string
): Promise<IntercomConversation> {
  return intercomFetch<IntercomConversation>(
    `/conversations/${conversationId}`
  );
}

/**
 * Fetch multiple conversations by ID with concurrency limiting.
 * Returns a map of conversationId → conversation for successfully fetched ones.
 */
export async function fetchConversationsBatch(
  conversationIds: string[]
): Promise<Map<string, IntercomConversation>> {
  const results = new Map<string, IntercomConversation>();
  const uniqueIds = [...new Set(conversationIds)];

  // Process in batches to respect rate limits
  for (let i = 0; i < uniqueIds.length; i += CONCURRENCY_LIMIT) {
    const batch = uniqueIds.slice(i, i + CONCURRENCY_LIMIT);
    const promises = batch.map(async (id) => {
      try {
        const conv = await fetchConversation(id);
        results.set(id, conv);
      } catch (error) {
        console.warn(`Failed to fetch conversation ${id}:`, error);
      }
    });
    await Promise.all(promises);
  }

  return results;
}
