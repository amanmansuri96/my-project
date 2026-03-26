import { intercomFetch } from "./client";
import { toUnixTimestamp } from "@/lib/utils/date";
import { toSlimConversation, type SlimConversation } from "./slim-conversation";
import type { ConversationSearchResponse } from "./types";

interface IncrementalResult {
  conversations: SlimConversation[];
  fetchMode: "full" | "incremental";
  pagesFetched: number;
}

/**
 * Fetch conversations incrementally from Intercom.
 *
 * If lastRefreshTime is null → full fetch (first run or new month).
 * If lastRefreshTime is provided → two targeted queries:
 *   1. New conversations: created_at > lastRefreshTime
 *   2. Updated conversations: created_at in [monthStart, lastRefreshTime) AND updated_at > lastRefreshTime
 *
 * Both queries post-filter for "Customer ticket" category and convert to SlimConversation.
 */
export async function fetchIncrementalConversations(
  monthStart: Date,
  now: Date,
  sourceType: string,
  lastRefreshTime: Date | null
): Promise<IncrementalResult> {
  if (!lastRefreshTime) {
    console.log(`[Incremental] No previous refresh found — doing full fetch`);
    const { conversations, pagesFetched } = await fetchAllPages(monthStart, now, sourceType);
    return { conversations, fetchMode: "full", pagesFetched };
  }

  console.log(`[Incremental] Last refresh: ${lastRefreshTime.toISOString()} — fetching changes since then`);

  // Query 1: New conversations created after last refresh
  const newResult = await fetchAllPages(lastRefreshTime, now, sourceType, "new");

  // Query 2: Updated conversations — created before last refresh, updated after it
  const updatedResult = await fetchUpdatedConversations(
    monthStart,
    lastRefreshTime,
    now,
    sourceType
  );

  // Deduplicate by conversation ID (a conversation could match both queries in edge cases)
  const seen = new Set<string>();
  const merged: SlimConversation[] = [];

  for (const conv of [...newResult.conversations, ...updatedResult.conversations]) {
    if (!seen.has(conv.id)) {
      seen.add(conv.id);
      merged.push(conv);
    }
  }

  const totalPages = newResult.pagesFetched + updatedResult.pagesFetched;
  console.log(
    `[Incremental] Done: ${newResult.conversations.length} new + ${updatedResult.conversations.length} updated = ${merged.length} unique conversations across ${totalPages} pages`
  );

  return { conversations: merged, fetchMode: "incremental", pagesFetched: totalPages };
}

/**
 * Fetch all pages matching created_at in [startDate, endDate) for a given source type.
 * Post-filters for "Customer ticket" and converts to SlimConversation.
 */
async function fetchAllPages(
  startDate: Date,
  endDate: Date,
  sourceType: string,
  label?: string
): Promise<{ conversations: SlimConversation[]; pagesFetched: number }> {
  const all: SlimConversation[] = [];
  let cursor: string | undefined;
  let pagesFetched = 0;
  const tag = label ? `[${label}]` : "";

  do {
    const body: Record<string, unknown> = {
      query: {
        operator: "AND",
        value: [
          { field: "source.type", operator: "=", value: sourceType },
          { field: "created_at", operator: ">", value: toUnixTimestamp(startDate) },
          { field: "created_at", operator: "<", value: toUnixTimestamp(endDate) },
        ],
      },
      pagination: {
        per_page: 150,
        ...(cursor ? { starting_after: cursor } : {}),
      },
    };

    const response = await intercomFetch<ConversationSearchResponse>(
      "/conversations/search",
      { method: "POST", body: JSON.stringify(body) }
    );

    pagesFetched++;

    if (pagesFetched === 1) {
      console.log(
        `[Incremental] ${tag} ${sourceType}: ${response.total_count} total, ${response.pages?.total_pages ?? "?"} pages`
      );
    }

    for (const conv of response.conversations) {
      const category = conv.custom_attributes?.["Ticket category"];
      const hasTeammate = conv.teammates?.admins?.length && conv.teammates.admins.length > 0;
      if (category !== "Customer ticket" || !hasTeammate) continue;

      const slim = toSlimConversation(conv);
      if (slim) all.push(slim);
    }

    cursor = response.pages?.next?.starting_after;

    if (pagesFetched % 10 === 0) {
      console.log(`[Incremental] ${tag} Page ${pagesFetched}, ${all.length} conversations so far...`);
    }
  } while (cursor);

  return { conversations: all, pagesFetched };
}

/**
 * Fetch conversations that were created before lastRefreshTime but updated after it.
 * This catches CX scores, re-assignments, and other post-resolution updates.
 *
 * Intercom's search API supports `updated_at` as a filter field.
 */
async function fetchUpdatedConversations(
  monthStart: Date,
  lastRefreshTime: Date,
  now: Date,
  sourceType: string
): Promise<{ conversations: SlimConversation[]; pagesFetched: number }> {
  const all: SlimConversation[] = [];
  let cursor: string | undefined;
  let pagesFetched = 0;

  do {
    const body: Record<string, unknown> = {
      query: {
        operator: "AND",
        value: [
          { field: "source.type", operator: "=", value: sourceType },
          { field: "created_at", operator: ">", value: toUnixTimestamp(monthStart) },
          { field: "created_at", operator: "<", value: toUnixTimestamp(lastRefreshTime) },
          { field: "updated_at", operator: ">", value: toUnixTimestamp(lastRefreshTime) },
        ],
      },
      pagination: {
        per_page: 150,
        ...(cursor ? { starting_after: cursor } : {}),
      },
    };

    const response = await intercomFetch<ConversationSearchResponse>(
      "/conversations/search",
      { method: "POST", body: JSON.stringify(body) }
    );

    pagesFetched++;

    if (pagesFetched === 1) {
      console.log(
        `[Incremental] [updated] ${sourceType}: ${response.total_count} total, ${response.pages?.total_pages ?? "?"} pages`
      );
    }

    for (const conv of response.conversations) {
      const category = conv.custom_attributes?.["Ticket category"];
      const hasTeammate = conv.teammates?.admins?.length && conv.teammates.admins.length > 0;
      if (category !== "Customer ticket" || !hasTeammate) continue;

      const slim = toSlimConversation(conv);
      if (slim) all.push(slim);
    }

    cursor = response.pages?.next?.starting_after;
  } while (cursor);

  return { conversations: all, pagesFetched };
}
