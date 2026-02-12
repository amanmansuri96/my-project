import type { MetricDirection } from "@/types";

interface AgentValue {
  agentId: string;
  value: number;
}

/**
 * Compute percentile rank (0-100) for each agent within a single metric.
 *
 * - "lower_is_better": lowest raw value → highest percentile (100)
 * - "higher_is_better": highest raw value → highest percentile (100)
 * - Ties get the same percentile (average rank method)
 */
export function computePercentiles(
  agents: AgentValue[],
  direction: MetricDirection
): Map<string, number> {
  const result = new Map<string, number>();
  const n = agents.length;

  if (n === 0) return result;
  if (n === 1) {
    result.set(agents[0].agentId, 100);
    return result;
  }

  // Sort ascending by value
  const sorted = [...agents].sort((a, b) => a.value - b.value);

  // Assign ranks (1-based) with average rank for ties
  // After sorting ascending: index 0 = lowest value, index n-1 = highest value
  const ranks = new Map<string, number>();
  let i = 0;
  while (i < n) {
    // Find the group of agents with the same value
    let j = i;
    while (j < n && sorted[j].value === sorted[i].value) {
      j++;
    }
    // Average rank for this group (1-based ranks: i+1 through j)
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      ranks.set(sorted[k].agentId, avgRank);
    }
    i = j;
  }

  // Convert rank to percentile
  // For "lower_is_better": rank 1 (lowest value) → percentile 100
  // For "higher_is_better": rank N (highest value) → percentile 100
  for (const [agentId, rank] of ranks) {
    let percentile: number;
    if (direction === "lower_is_better") {
      // Rank 1 = best (lowest value) → percentile 100
      percentile = ((n - rank) / (n - 1)) * 100;
    } else {
      // Rank N = best (highest value) → percentile 100
      percentile = ((rank - 1) / (n - 1)) * 100;
    }
    result.set(agentId, percentile);
  }

  return result;
}
