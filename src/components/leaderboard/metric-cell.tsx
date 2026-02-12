"use client";

import { formatPercentile } from "@/lib/utils/format";

export function MetricCell({
  rawValue,
  percentile,
  isEligible,
}: {
  rawValue: string;
  percentile: number;
  isEligible: boolean;
}) {
  const barColor =
    percentile >= 75
      ? "bg-green-500"
      : percentile >= 50
        ? "bg-yellow-500"
        : percentile >= 25
          ? "bg-orange-500"
          : "bg-red-500";

  return (
    <div className={`space-y-1 ${!isEligible ? "opacity-40" : ""}`}>
      <div className="text-sm font-medium">{rawValue}</div>
      {isEligible && (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${percentile}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">
            {formatPercentile(percentile)}
          </span>
        </div>
      )}
    </div>
  );
}
