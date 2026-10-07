/**
 * Finishes setup after the first sign-in: makes that user an admin and opens the first market
 * (the ASL S22 Grand Final), in one step. Safe to run twice.
 *
 *   pnpm db:go-live <clerk-user-id>        (the id is shown at the bottom of /portfolio)
 *
 * Uses DATABASE_URL_UNPOOLED (or DATABASE_URL) from .env.local or the environment.
 */
import { readFileSync } from "node:fs";

import { neonConfig, Pool } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import { eloPrior } from "@/lib/market/priors";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { createMarket, ensureHouseAccount } from "@/lib/services/ledger";
import { userId } from "@/lib/types/ids";

import { S22_FINAL } from "@/features/admin/s22-final";

import { loadEnvLocal } from "./env";

function currentElo(player: string): number | undefined {
  const rows = JSON.parse(readFileSync("data/generated/elo.json", "utf8")) as { player: string; currentElo: number }[];
  return rows.find((r) => r.player === player)?.currentElo;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const id = process.argv[2];
  if (!id) throw new Error("Usage: pnpm db:go-live <clerk-user-id>  (find it at the bottom of /portfolio)");
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL in .env.local first (vercel env pull .env.local).");
  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle({ client: pool, schema }) as unknown as Db;
    const [user] = await db
      .update(schema.users)
      .set({ isAdmin: true })
      .where(eq(schema.users.id, id))
      .returning({ name: schema.users.displayName });
    if (!user) throw new Error(`No user ${id}. Sign in on the site once, then run this again.`);
    console.warn(`${user.name} is an admin.`);

    await ensureHouseAccount(db);
    const [existing] = await db.select({ id: schema.markets.id }).from(schema.markets).where(eq(schema.markets.slug, S22_FINAL.slug));
    if (existing) {
      console.warn(`The S22 final market already exists: /markets/${S22_FINAL.slug}`);
      return;
    }
    const prior = eloPrior(currentElo("Rush"), currentElo("Soulkey"));
    const result = await createMarket(db, {
      ...S22_FINAL,
      outcomes: S22_FINAL.outcomes.map((o) => ({ ...o })),
      closesAt: new Date(S22_FINAL.closesAt),
      prior,
      createdBy: userId(id),
    });
    if ("error" in result) throw new Error(result.error.message ?? result.error.code);
    console.warn(
      `Opened /markets/${result.data.slug} at Rush ${(prior[0] * 100).toFixed(0)}% / Soulkey ${(prior[1] * 100).toFixed(0)}% (before the 2% floor).`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
