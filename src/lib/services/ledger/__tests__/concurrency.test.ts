// @vitest-environment node
/**
 * The concurrency test from Docs/foundation-specs/ledger.md: 50 simultaneous trades from 10
 * users on one market, against a real Postgres. Runs only when DATABASE_URL_TEST is set (a
 * throwaway Neon branch); it truncates every table there. `pnpm test:ledger-concurrency`.
 */
import { join } from "node:path";

import { neonConfig, Pool } from "@neondatabase/serverless";
import { asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import ws from "ws";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as lmsr from "@/lib/market/lmsr";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { userId } from "@/lib/types/ids";

import { checkLedgerInvariants, createMarket, ensureUser, executeTrade } from "../index";

const url = process.env.DATABASE_URL_TEST;
neonConfig.webSocketConstructor = ws;

describe.skipIf(!url)("ledger under concurrency (real Postgres)", () => {
  let pool: Pool;
  let db: Db;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 20 });
    db = drizzle({ client: pool, schema }) as unknown as Db;
    await migrate(drizzle({ client: pool, schema }), {
      migrationsFolder: join(process.cwd(), "drizzle"),
    });
    await db.execute(
      sql`truncate ledger_entries, trades, positions, market_outcomes, markets, accounts, users restart identity cascade`,
    );
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
  });

  it("50 simultaneous trades keep every invariant", async () => {
    await db.insert(schema.users).values({ id: "admin", displayName: "Admin", isAdmin: true });
    const users = Array.from({ length: 10 }, (_, n) => userId(`user_${n}`));
    for (const u of users) await ensureUser(db, { userId: u, displayName: u });
    const created = await createMarket(db, {
      slug: "concurrency",
      question: "Concurrency test market?",
      b: 10,
      closesAt: new Date(Date.now() + 3600_000),
      outcomes: [{ label: "A" }, { label: "B" }, { label: "C" }],
      createdBy: userId("admin"),
    });
    if ("error" in created) throw new Error(created.error.code);
    const market = created.data.marketId;

    const results = await Promise.all(
      Array.from({ length: 50 }, (_, n) =>
        executeTrade(db, {
          userId: users[n % 10] ?? userId("user_0"),
          marketId: market,
          outcomeIdx: n % 3,
          mode: "buy_spend",
          amount: 1 + (n % 4),
          idempotencyKey: `concurrency-${n}`,
        }),
      ),
    );
    const filled = results.filter((r) => "data" in r);
    expect(filled.length).toBeGreaterThan(40);

    expect(await checkLedgerInvariants(db)).toEqual([]);
    const outcomes = await db
      .select()
      .from(schema.marketOutcomes)
      .where(eq(schema.marketOutcomes.marketId, market))
      .orderBy(asc(schema.marketOutcomes.idx));
    const q = outcomes.map((o) => Number(o.q));
    const q0 = outcomes.map((o) => Number(o.q0));
    const paid = filled.reduce((sum, r) => sum + ("data" in r ? r.data.cost : 0), 0);
    expect(Math.abs(paid - (lmsr.cost(10, q) - lmsr.cost(10, q0)))).toBeLessThan(1e-3);
  }, 120_000);
});
