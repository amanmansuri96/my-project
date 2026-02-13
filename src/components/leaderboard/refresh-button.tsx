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

      if (data.status === "triggered") {
        setResult("Refresh queued — data will update shortly");
      } else {
        setResult(`Error: ${data.error || "Unknown error"}`);
      }
    } catch {
      setResult("Failed to queue refresh. Check your connection.");
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
        {loading ? "Queuing..." : "Refresh Rankings"}
      </Button>
    </div>
  );
}
