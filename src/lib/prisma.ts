import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient as createLibsqlClient } from "@libsql/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// When deployed (TURSO_DATABASE_URL set), talk to the hosted libSQL/Turso database over
// HTTP via the driver adapter — no local file, works fine on serverless/ephemeral hosting.
// Otherwise (the double-click Mac app), fall back to the plain local SQLite file.
function makeClient(): PrismaClient {
  if (process.env.TURSO_DATABASE_URL) {
    const libsql = createLibsqlClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter });
  }
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
