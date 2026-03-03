"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RefreshButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleRefresh() {
    setLoading(true);
    setResult("Refreshing — this takes ~15 minutes...");

    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const data = await res.json();

      const summary = data.results
        ?.map(
          (r: { channel: string; agentCount: number; status: string }) =>
            `${r.channel}: ${r.agentCount} agents (${r.status})`
        )
        .join(", ");

      setResult(summary || "Refresh complete — reload the page");
    } catch {
      setResult("Failed to refresh. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className="text-sm text-gray-600">{result}</span>
      )}
      <Button onClick={handleRefresh} disabled={loading} variant="outline">
        {loading ? "Refreshing..." : "Refresh Rankings"}
      </Button>
    </div>
  );
}
