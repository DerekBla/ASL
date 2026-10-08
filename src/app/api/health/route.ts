import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { isAuthEnabled, isMarketsEnabled } from "@/lib/config/env";
import { getReadDb, withWriteDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

type Health = {
  markets: boolean;
  auth: boolean;
  /** HTTP driver (reads). */
  readDb: "ok" | "off" | "error";
  /** WebSocket pool with a transaction (the path every trade and sign-up takes). */
  writeDb: "ok" | "off" | "error";
};

/** Smoke test for the deployment. Reports only ok/error, never connection details. */
export async function GET(): Promise<NextResponse<Health>> {
  const health: Health = {
    markets: isMarketsEnabled(),
    auth: isAuthEnabled(),
    readDb: "off",
    writeDb: "off",
  };
  if (health.markets) {
    try {
      await getReadDb().execute(sql`select 1`);
      health.readDb = "ok";
    } catch (error) {
      console.error("health: read db", error);
      health.readDb = "error";
    }
    try {
      await withWriteDb((db) => db.transaction(async (tx) => tx.execute(sql`select 1`)));
      health.writeDb = "ok";
    } catch (error) {
      console.error("health: write db", error);
      health.writeDb = "error";
    }
  }
  const ok = !health.markets || (health.readDb === "ok" && health.writeDb === "ok");
  return NextResponse.json(health, {
    status: ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
