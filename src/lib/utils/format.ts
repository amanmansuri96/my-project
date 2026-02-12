export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours}h`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatPercentile(value: number): string {
  const rounded = Math.round(value);
  const suffix =
    rounded % 10 === 1 && rounded !== 11
      ? "st"
      : rounded % 10 === 2 && rounded !== 12
        ? "nd"
        : rounded % 10 === 3 && rounded !== 13
          ? "rd"
          : "th";
  return `${rounded}${suffix}`;
}
