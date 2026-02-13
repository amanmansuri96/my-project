import { Inngest } from "inngest";

type Events = {
  "refresh/rankings.requested": {
    data: {
      channel: "chat" | "email";
      qaScores?: Record<string, number>;
    };
  };
};

export const inngest = new Inngest({
  id: "agent-ranker",
  schemas: new Map() as never, // typed via generics
}) as Inngest & { send: (event: { name: keyof Events; data: Events[keyof Events]["data"] } | Array<{ name: keyof Events; data: Events[keyof Events]["data"] }>) => Promise<unknown> };

export type { Events };
