import type { AgentMetrics } from "@/types";

const MIN_CONVERSATIONS = 100;

export interface EligibilityResult {
  eligible: AgentMetrics[];
  ineligible: AgentMetrics[];
}

export function filterEligible(agents: AgentMetrics[]): EligibilityResult {
  const eligible: AgentMetrics[] = [];
  const ineligible: AgentMetrics[] = [];

  for (const agent of agents) {
    if (agent.conversationCount >= MIN_CONVERSATIONS) {
      eligible.push(agent);
    } else {
      ineligible.push(agent);
    }
  }

  return { eligible, ineligible };
}
