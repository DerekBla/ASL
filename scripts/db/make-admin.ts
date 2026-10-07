/**
 * Makes a signed-in user an admin: `pnpm db:make-admin <clerk-user-id>`.
 * The user must have signed in at least once (that creates their row and 100 minerals).
 * Their Clerk user id is shown on the /portfolio page.
 */
import { neonConfig, Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import { loadEnvLocal } from "./env";

async function main(): Promise<void> {
  loadEnvLocal();
  const id = process.argv[2];
  if (!id) throw new Error("Usage: pnpm db:make-admin <clerk-user-id>");
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL in .env.local first.");
  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: url });
  try {
    const result = await drizzle({ client: pool }).execute(
      sql`update users set is_admin = true where id = ${id} returning display_name`,
    );
    const name = (result.rows[0] as { display_name?: string } | undefined)?.display_name;
    if (!name) throw new Error(`No user ${id}. Sign in on the site once, then run this again.`);
    console.warn(`${name} (${id}) is now an admin.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
