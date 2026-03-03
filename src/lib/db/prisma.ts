import { PrismaClient } from "@/generated/prisma/client";
import { createClient } from "@libsql/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;

  if (tursoUrl) {
    const libsql = createClient({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSql(libsql);
    console.log("[Prisma] Connecting to Turso:", tursoUrl);
    return new PrismaClient({ adapter });
  }

  // Local dev: use better-sqlite3 (dynamic require since it's a devDependency)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

  const dbUrl = getLocalDbUrl();
  console.log("[Prisma] Connecting to local SQLite:", dbUrl);
  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  return new PrismaClient({ adapter });
}

function getLocalDbUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && envUrl.startsWith("file:")) {
    const relativePath = envUrl.replace("file:", "").replace(/^\.\//, "");
    return `${process.cwd()}/${relativePath}`;
  }
  return envUrl ?? `${process.cwd()}/dev.db`;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
