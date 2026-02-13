import type { AgentMetrics } from "@/types";

const DEFAULT_MIN_CONVERSATIONS = 100;

export interface EligibilityResult {
  eligible: AgentMetrics[];
  ineligible: AgentMetrics[];
}

export function filterEligible(
  agents: AgentMetrics[],
  minConversations = DEFAULT_MIN_CONVERSATIONS
): EligibilityResult {
  const eligible: AgentMetrics[] = [];
  const ineligible: AgentMetrics[] = [];

  for (const agent of agents) {
    if (agent.conversationCount >= minConversations) {
      eligible.push(agent);
    } else {
      ineligible.push(agent);
    }
  }

  return { eligible, ineligible };
}
