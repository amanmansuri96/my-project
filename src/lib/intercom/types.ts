export interface IntercomTicket {
  id: string;
  type: "ticket";
  ticket_id: string;
  category: string; // "request" = customer ticket
  admin_assignee_id: string | null;
  team_assignee_id: string | null;
  conversation_id: string | null;
  ticket_state: string;
  created_at: number;
  updated_at: number;
}

export interface IntercomConversation {
  id: string;
  type: "conversation";
  admin_assignee_id: string | null;
  statistics: ConversationStatistics;
  custom_attributes: Record<string, unknown>;
  conversation_rating?: ConversationRating;
}

export interface ConversationStatistics {
  type: "conversation_statistics";
  time_to_assignment: number | null;
  time_to_admin_reply: number | null;
  first_contact_reply_at: number | null;
  first_assignment_at: number | null;
  first_admin_reply_at: number | null;
  last_assignment_at: number | null;
  last_admin_reply_at: number | null;
  first_close_at: number | null;
  last_close_at: number | null;
  handling_time: number | null;
  count_reopens: number;
  count_assignments: number;
  count_conversation_parts: number;
  median_time_to_reply: number | null;
}

export interface ConversationRating {
  rating: number | null;
  remark: string | null;
  created_at: number | null;
}

export interface IntercomAdmin {
  id: string;
  type: "admin";
  name: string;
  email: string;
  job_title: string | null;
  away_mode_enabled: boolean;
  has_inbox_seat: boolean;
}

export interface IntercomPaginatedResponse<T> {
  type: "list" | "ticket.list";
  data: T[];
  pages?: {
    type: "pages";
    page: number;
    per_page: number;
    total_pages: number;
    next?: {
      page: number;
      starting_after: string;
    };
  };
}

export interface IntercomSearchResponse<T> {
  type: string;
  data: T[];
  total_count: number;
  pages?: {
    type: "pages";
    page: number;
    per_page: number;
    total_pages: number;
    next?: {
      page: number;
      starting_after: string;
    };
  };
}
