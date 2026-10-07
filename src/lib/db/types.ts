import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type * as schema from "./schema";

/**
 * Any Drizzle Postgres database with our schema: Neon in production, PGlite in tests.
 * Ledger operations take one of these, so the same code runs against both.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** The handle inside db.transaction(async (tx) => ...). */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Either a database or an open transaction. */
export type DbOrTx = Db | Tx;
