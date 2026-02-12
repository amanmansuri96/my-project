import { startOfMonth } from "date-fns";

export function getMTDRange(): { start: Date; end: Date } {
  const now = new Date();
  return {
    start: startOfMonth(now),
    end: now,
  };
}

export function toUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}
