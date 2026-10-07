/**
 * Applies drizzle/ migrations to the database in DATABASE_URL_UNPOOLED (or DATABASE_URL), and
 * creates the house account. Run with `pnpm db:migrate` after filling in .env.local.
 */
import { neonConfig, Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import ws from "ws";

import { loadEnvLocal } from "./env";

async function main(): Promise<void> {
  loadEnvLocal();
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL_UNPOOLED (or DATABASE_URL) in .env.local first.");
  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle({ client: pool });
    await migrate(db, { migrationsFolder: "drizzle" });
    await db.execute(sql`insert into accounts (is_house) values (true) on conflict do nothing`);
    console.warn("Migrations applied; house account ready.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
