import { Card, CardContent } from "@/components/ui/card";
import { formatDuration, formatPercent } from "@/lib/utils/format";

interface TeamMetricsProps {
  metrics: {
    agentCount: number;
    totalConversations: number;
    avgP95Frt: number;
    avgAht: number;
    avgCxScore: number;
    avgQaScore: number | null;
  };
}

export function TeamMetrics({ metrics }: TeamMetricsProps) {
  const items = [
    {
      label: "Agents",
      value: String(metrics.agentCount),
      sub: `${metrics.totalConversations.toLocaleString()} conversations`,
    },
    {
      label: "Avg p95 FRT",
      value: formatDuration(metrics.avgP95Frt),
      sub: "Team average",
    },
    {
      label: "Avg Handling Time",
      value: formatDuration(metrics.avgAht),
      sub: "Team average",
    },
    {
      label: "CX Score",
      value: formatPercent(metrics.avgCxScore),
      sub: "Team average",
    },
    ...(metrics.avgQaScore !== null
      ? [
          {
            label: "QA Score",
            value: metrics.avgQaScore.toFixed(1),
            sub: "Team average",
          },
        ]
      : []),
  ];

  return (
    <Card className="mb-4">
      <CardContent className="py-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {items.map((item) => (
            <div key={item.label} className="text-center">
              <p className="text-xs text-gray-500 mb-1">{item.label}</p>
              <p className="text-2xl font-bold text-gray-900">{item.value}</p>
              <p className="text-xs text-gray-400">{item.sub}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
