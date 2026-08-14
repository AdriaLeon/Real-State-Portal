// Prisma Client singleton.
//
// Instantiating a fresh PrismaClient per import would exhaust
// MySQL's connection pool, so one instance is cached on globalThis.
//
// Prisma 7 has no built-in query engine for relational DBs anymore
// (https://pris.ly/d/prisma7-client-config). PrismaClient needs a driver
// adapter to actually talk to the database. PrismaMariaDb accepts a plain
// MySQL connection string.

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Add it to .env (see .env.example) before using the database.");
  }
  const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
