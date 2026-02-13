import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const dbPath = path.resolve(process.cwd(), "dev.db");
const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter });

const MOCK_AGENTS = [
  { name: "Priya Sharma", email: "priya@aspora.com", convos: 245, p95: 42, aht: 210, cx: 88, qa: 91 },
  { name: "Ahmed Khan", email: "ahmed@aspora.com", convos: 198, p95: 55, aht: 185, cx: 92, qa: 87 },
  { name: "Sarah Mitchell", email: "sarah@aspora.com", convos: 220, p95: 38, aht: 240, cx: 85, qa: 94 },
  { name: "Ravi Patel", email: "ravi@aspora.com", convos: 187, p95: 67, aht: 195, cx: 90, qa: 82 },
  { name: "Fatima Al-Hassan", email: "fatima@aspora.com", convos: 210, p95: 48, aht: 220, cx: 87, qa: 89 },
  { name: "James Wilson", email: "james@aspora.com", convos: 175, p95: 72, aht: 260, cx: 78, qa: 76 },
  { name: "Aisha Begum", email: "aisha@aspora.com", convos: 230, p95: 35, aht: 175, cx: 94, qa: 93 },
  { name: "Tom Richards", email: "tom@aspora.com", convos: 160, p95: 85, aht: 280, cx: 75, qa: 71 },
  { name: "Meera Nair", email: "meera@aspora.com", convos: 205, p95: 50, aht: 200, cx: 89, qa: 88 },
  { name: "Hassan Ali", email: "hassan@aspora.com", convos: 190, p95: 60, aht: 230, cx: 83, qa: 85 },
  { name: "Emma Thompson", email: "emma@aspora.com", convos: 215, p95: 44, aht: 190, cx: 91, qa: 90 },
  { name: "Raj Verma", email: "raj@aspora.com", convos: 170, p95: 78, aht: 250, cx: 80, qa: 78 },
  { name: "Zara Hussain", email: "zara@aspora.com", convos: 225, p95: 40, aht: 180, cx: 93, qa: 92 },
  { name: "David Brown", email: "david@aspora.com", convos: 155, p95: 90, aht: 290, cx: 72, qa: 69 },
  { name: "Ananya Gupta", email: "ananya@aspora.com", convos: 200, p95: 52, aht: 205, cx: 86, qa: 86 },
  { name: "Omar Farooq", email: "omar@aspora.com", convos: 180, p95: 65, aht: 235, cx: 82, qa: 80 },
  { name: "Lisa Chen", email: "lisa@aspora.com", convos: 195, p95: 58, aht: 215, cx: 84, qa: 83 },
  { name: "Vikram Singh", email: "vikram@aspora.com", convos: 140, p95: 95, aht: 300, cx: 70, qa: 65 },
  { name: "Noor Iqbal", email: "noor@aspora.com", convos: 210, p95: 46, aht: 188, cx: 90, qa: 91 },
  { name: "Chris Taylor", email: "chris@aspora.com", convos: 165, p95: 80, aht: 265, cx: 77, qa: 74 },
  // Below 100 convos — ineligible
  { name: "Amy Parker", email: "amy@aspora.com", convos: 45, p95: 30, aht: 150, cx: 95, qa: 96 },
  { name: "Kiran Reddy", email: "kiran@aspora.com", convos: 72, p95: 55, aht: 200, cx: 82, qa: 80 },
];

async function seed() {
  console.log("Seeding database with mock data...");

  // Clear existing data
  await prisma.rankingSnapshot.deleteMany();
  await prisma.refreshLog.deleteMany();
  await prisma.agent.deleteMany();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Compute percentiles
  const eligible = MOCK_AGENTS.filter((a) => a.convos >= 100);
  const n = eligible.length;

  function percentile(values: number[], myVal: number, lowerIsBetter: boolean): number {
    const sorted = [...values].sort((a, b) => a - b);
    const rank = sorted.indexOf(myVal) + 1;
    if (n <= 1) return 100;
    return lowerIsBetter
      ? ((n - rank) / (n - 1)) * 100
      : ((rank - 1) / (n - 1)) * 100;
  }

  const p95Values = eligible.map((a) => a.p95);
  const ahtValues = eligible.map((a) => a.aht);
  const cxValues = eligible.map((a) => a.cx);
  const qaValues = eligible.map((a) => a.qa);

  // Create agents with rankings
  const rankings = MOCK_AGENTS.map((agent) => {
    const isEligible = agent.convos >= 100;
    const p95P = isEligible ? percentile(p95Values, agent.p95, true) : 0;
    const ahtP = isEligible ? percentile(ahtValues, agent.aht, true) : 0;
    const cxP = isEligible ? percentile(cxValues, agent.cx, false) : 0;
    const qaP = isEligible ? percentile(qaValues, agent.qa, false) : 0;
    const composite = isEligible ? (p95P + ahtP + cxP + qaP) / 4 : 0;

    return { ...agent, isEligible, p95P, ahtP, cxP, qaP, composite };
  });

  // Sort eligible by composite descending
  const eligibleRanked = rankings
    .filter((r) => r.isEligible)
    .sort((a, b) => b.composite - a.composite);
  const ineligibleAgents = rankings.filter((r) => !r.isEligible);

  // Assign ranks
  eligibleRanked.forEach((r, i) => {
    (r as typeof r & { rank: number }).rank = i + 1;
  });

  for (const r of [...eligibleRanked, ...ineligibleAgents]) {
    const agent = await prisma.agent.create({
      data: {
        intercomAdminId: r.email.split("@")[0],
        displayName: r.name,
        email: r.email,
        isActive: true,
      },
    });

    await prisma.rankingSnapshot.create({
      data: {
        agentId: agent.id,
        periodStart: startOfMonth,
        periodEnd: now,
        snapshotDate: now,
        conversationCount: r.convos,
        p95ResponseTimeSeconds: r.p95,
        avgHandlingTimeSeconds: r.aht,
        cxScorePercent: r.cx,
        qaScore: r.qa,
        p95ResponsePercentile: r.p95P,
        ahtPercentile: r.ahtP,
        cxScorePercentile: r.cxP,
        qaScorePercentile: r.qaP,
        compositeScore: r.composite,
        rank: (r as typeof r & { rank?: number }).rank ?? 0,
        isEligible: r.isEligible,
      },
    });
  }

  await prisma.refreshLog.create({
    data: {
      startedAt: now,
      completedAt: now,
      status: "success",
      agentCount: MOCK_AGENTS.length,
      ticketCount: MOCK_AGENTS.reduce((sum, a) => sum + a.convos, 0),
    },
  });

  console.log(`Seeded ${MOCK_AGENTS.length} agents (${eligible.length} eligible, ${MOCK_AGENTS.length - eligible.length} ineligible)`);
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
