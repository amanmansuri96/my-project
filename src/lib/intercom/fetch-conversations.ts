import { intercomFetch } from "./client";
import { toUnixTimestamp } from "@/lib/utils/date";
import type { IntercomConversation, ConversationSearchResponse } from "./types";

/**
 * Fetch customer conversations within a date range for a given channel.
 *
 * Uses POST /conversations/search with API-level filters:
 *   - source.type = sourceType ("conversation" for chat, "email" for email)
 *   - created_at within MTD range
 *
 * Then post-filters for:
 *   - custom_attributes["Ticket category"] = "Customer ticket"
 *   - admin_assignee_id is present
 */
export async function fetchCustomerConversations(
  startDate: Date,
  endDate: Date,
  sourceType: string = "conversation"
): Promise<IntercomConversation[]> {
  const allConversations: IntercomConversation[] = [];
  let cursor: string | undefined;
  let pageCount = 0;

  do {
    const body: Record<string, unknown> = {
      query: {
        operator: "AND",
        value: [
          {
            field: "source.type",
            operator: "=",
            value: sourceType,
          },
          {
            field: "created_at",
            operator: ">",
            value: toUnixTimestamp(startDate),
          },
          {
            field: "created_at",
            operator: "<",
            value: toUnixTimestamp(endDate),
          },
        ],
      },
      pagination: {
        per_page: 150,
        ...(cursor ? { starting_after: cursor } : {}),
      },
    };

    const response = await intercomFetch<ConversationSearchResponse>(
      "/conversations/search",
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    pageCount++;
    if (pageCount === 1) {
      console.log(
        `[Intercom] ${sourceType} conversations search: ${response.total_count} total, ${response.pages?.total_pages ?? "?"} pages`
      );
    }

    // Post-filter: only "Customer ticket" category with at least one teammate (first replier)
    const filtered = response.conversations.filter((conv) => {
      const category = conv.custom_attributes?.["Ticket category"];
      const hasTeammate = conv.teammates?.admins?.length && conv.teammates.admins.length > 0;
      return category === "Customer ticket" && hasTeammate;
    });

    allConversations.push(...filtered);
    cursor = response.pages?.next?.starting_after;

    if (pageCount % 10 === 0) {
      console.log(
        `[Intercom] Fetched page ${pageCount}, ${allConversations.length} ${sourceType} customer conversations so far...`
      );
    }
  } while (cursor);

  console.log(
    `[Intercom] Done: ${allConversations.length} ${sourceType} customer conversations across ${pageCount} pages`
  );

  return allConversations;
}

export interface BatchResult {
  conversations: IntercomConversation[];
  nextCursor: string | undefined;
  pagesFetched: number;
}

/**
 * Fetch up to `maxPages` pages of conversations, returning a cursor
 * so the next Inngest step can continue where this one left off.
 */
export async function fetchConversationBatch(
  startDate: Date,
  endDate: Date,
  sourceType: string,
  startCursor: string | undefined,
  maxPages: number = 12
): Promise<BatchResult> {
  const conversations: IntercomConversation[] = [];
  let cursor = startCursor;
  let pagesFetched = 0;

  do {
    const body: Record<string, unknown> = {
      query: {
        operator: "AND",
        value: [
          { field: "source.type", operator: "=", value: sourceType },
          {
            field: "created_at",
            operator: ">",
            value: toUnixTimestamp(startDate),
          },
          {
            field: "created_at",
            operator: "<",
            value: toUnixTimestamp(endDate),
          },
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

    if (pagesFetched === 1 && !startCursor) {
      console.log(
        `[Intercom] ${sourceType} batch: ${response.total_count} total, ${response.pages?.total_pages ?? "?"} pages`
      );
    }

    const filtered = response.conversations.filter((conv) => {
      const category = conv.custom_attributes?.["Ticket category"];
      const hasTeammate =
        conv.teammates?.admins?.length && conv.teammates.admins.length > 0;
      return category === "Customer ticket" && hasTeammate;
    });

    conversations.push(...filtered);
    cursor = response.pages?.next?.starting_after;
  } while (cursor && pagesFetched < maxPages);

  console.log(
    `[Intercom] Batch done: ${pagesFetched} pages, ${conversations.length} conversations, cursor: ${cursor ? "yes" : "end"}`
  );

  return { conversations, nextCursor: cursor, pagesFetched };
}
