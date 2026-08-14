// Prisma 7 config file — replaces the old `datasource { url }` block in
// schema.prisma (no longer allowed there) and the old `"prisma"` block in
// package.json (no longer read from there either).
//
// Only used by the Prisma CLI (generate/migrate/studio); the running app
// connects via a driver adapter instead (see lib/db/prisma.ts).

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
    shadowDatabaseUrl: env("SHADOW_DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --env-file=.env scripts/seed.ts",
  },
});
