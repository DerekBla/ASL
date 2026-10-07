/**
 * In-memory Postgres (PGlite) with the real migrations applied, for ledger and market tests.
 * Use in files marked `// @vitest-environment node`.
 *
 * PGlite runs one connection, so it checks behaviour and constraints but not row-lock
 * contention; the concurrency test in ledger.md needs a real Postgres (DATABASE_URL_TEST).
 */
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { userId } from "@/lib/types/ids";
import type { UserId } from "@/lib/types/ids";

export type TestDb = { db: Db; reset: () => Promise<void>; close: () => Promise<void> };

export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
  return {
    db: db as unknown as Db,
    reset: async () => {
      await db.execute(
        sql`truncate ledger_entries, trades, positions, market_outcomes, markets, accounts, users restart identity cascade`,
      );
    },
    close: () => client.close(),
  };
}

/** Inserts an admin user directly (in production this is a one-line SQL update by Derek). */
export async function makeAdmin(db: Db, id = "user_admin"): Promise<UserId> {
  await db
    .insert(schema.users)
    .values({ id, displayName: "Admin", isAdmin: true })
    .onConflictDoNothing();
  await db.update(schema.users).set({ isAdmin: true }).where(eq(schema.users.id, id));
  return userId(id);
}
