-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "intercomAdminId" TEXT NOT NULL,
    "anthropodAgentId" TEXT,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RankingSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "snapshotDate" DATETIME NOT NULL,
    "conversationCount" INTEGER NOT NULL,
    "p95ResponseTimeSeconds" REAL NOT NULL,
    "avgHandlingTimeSeconds" REAL NOT NULL,
    "cxScorePercent" REAL NOT NULL,
    "qaScore" REAL,
    "p95ResponsePercentile" REAL NOT NULL,
    "ahtPercentile" REAL NOT NULL,
    "cxScorePercentile" REAL NOT NULL,
    "qaScorePercentile" REAL,
    "compositeScore" REAL NOT NULL,
    "rank" INTEGER NOT NULL,
    "isEligible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RankingSnapshot_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefreshLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "status" TEXT NOT NULL,
    "errorMsg" TEXT,
    "agentCount" INTEGER,
    "ticketCount" INTEGER
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_intercomAdminId_key" ON "Agent"("intercomAdminId");

-- CreateIndex
CREATE INDEX "RankingSnapshot_snapshotDate_idx" ON "RankingSnapshot"("snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "RankingSnapshot_agentId_snapshotDate_key" ON "RankingSnapshot"("agentId", "snapshotDate");
