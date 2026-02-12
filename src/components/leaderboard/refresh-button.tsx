"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RefreshButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleRefresh() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const data = await res.json();

      if (data.status === "success") {
        setResult(
          `Refreshed: ${data.agentCount} agents, ${data.ticketCount} tickets`
        );
        // Reload to show new data
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setResult(`Error: ${data.errorMsg || "Unknown error"}`);
      }
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
