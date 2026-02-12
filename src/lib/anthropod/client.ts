import type { QAScoreEntry } from "@/types";
import Papa from "papaparse";

/**
 * Parse a QA scores CSV string into agent QA score entries.
 * Expected CSV format:
 *   agent_name,qa_score
 *   John Smith,87.5
 *   Jane Doe,92.1
 */
export function parseQAScoresCSV(csvContent: string): QAScoreEntry[] {
  const result = Papa.parse<{ agent_name: string; qa_score: string }>(
    csvContent,
    {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
    }
  );

  if (result.errors.length > 0) {
    const errorMsgs = result.errors.map((e) => e.message).join("; ");
    throw new Error(`CSV parse errors: ${errorMsgs}`);
  }

  const entries: QAScoreEntry[] = [];
  for (const row of result.data) {
    const name = row.agent_name?.trim();
    const score = parseFloat(row.qa_score);
    if (!name || isNaN(score)) continue;
    entries.push({ agentName: name, qaScore: score });
  }

  return entries;
}

/**
 * Convert QA score entries to a Map<agentName, score> for the ranking engine.
 */
export function qaScoresToMap(entries: QAScoreEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of entries) {
    map.set(entry.agentName, entry.qaScore);
  }
  return map;
}
