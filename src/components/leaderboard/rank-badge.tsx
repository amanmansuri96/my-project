import type { Tier } from "@/types";
import { Badge } from "@/components/ui/badge";

const tierStyles: Record<Tier["name"], string> = {
  Diamond: "bg-blue-100 text-blue-800 border-blue-300",
  Gold: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Silver: "bg-gray-100 text-gray-700 border-gray-300",
  Bronze: "bg-orange-100 text-orange-800 border-orange-300",
  Rising: "bg-green-100 text-green-800 border-green-300",
};

export function RankBadge({
  rank,
  tier,
}: {
  rank: number;
  tier: Tier;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xl font-bold text-gray-900 w-8 text-right">
        #{rank}
      </span>
      <Badge variant="outline" className={tierStyles[tier.name]}>
        {tier.name}
      </Badge>
    </div>
  );
}
