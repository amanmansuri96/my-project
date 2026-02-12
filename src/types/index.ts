export interface AgentMetrics {
  intercomAdminId: string;
  displayName: string;
  email?: string;
  conversationCount: number;
  p95ResponseTimeSeconds: number;
  avgHandlingTimeSeconds: number;
  cxScorePercent: number; // percentage of positive (4-5) CX ratings
  qaScore?: number;
}

export interface AgentRanking extends AgentMetrics {
  p95ResponsePercentile: number;
  ahtPercentile: number;
  cxScorePercentile: number;
  qaScorePercentile?: number;
  compositeScore: number;
  rank: number;
  isEligible: boolean;
  tier: Tier;
}

export interface Tier {
  name: "Diamond" | "Gold" | "Silver" | "Bronze" | "Rising";
  color: string;
}

export interface QAScoreEntry {
  agentName: string;
  qaScore: number;
}

export interface RefreshResult {
  status: "success" | "partial" | "failed";
  agentCount: number;
  ticketCount: number;
  errorMsg?: string;
}

export type MetricDirection = "lower_is_better" | "higher_is_better";

export interface MetricConfig {
  key: string;
  label: string;
  direction: MetricDirection;
  weight: number;
  formatValue: (value: number) => string;
}
