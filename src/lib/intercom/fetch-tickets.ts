import { intercomFetch } from "./client";
import { toUnixTimestamp } from "@/lib/utils/date";
import type { IntercomTicket, IntercomSearchResponse } from "./types";

/**
 * Fetch all customer tickets (category = "request") within a date range.
 * Uses POST /tickets/search with cursor-based pagination.
 */
export async function fetchCustomerTickets(
  startDate: Date,
  endDate: Date
): Promise<IntercomTicket[]> {
  const allTickets: IntercomTicket[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = {
      query: {
        operator: "AND",
        value: [
          {
            field: "category",
            operator: "=",
            value: "request",
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

    const response = await intercomFetch<IntercomSearchResponse<IntercomTicket>>(
      "/tickets/search",
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    allTickets.push(...response.data);
    cursor = response.pages?.next?.starting_after;
  } while (cursor);

  return allTickets;
}
