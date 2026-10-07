/**
 * Database connections (Docs/integration-specs/neon-drizzle.md). Server only, Node runtime.
 *
 * - withWriteDb: neon-serverless WebSocket Pool, the only driver that runs interactive
 *   transactions. Every ledger write goes through it. A pool is opened per call and closed
 *   after, as Neon recommends for serverless functions.
 * - getReadDb: neon-http, for read-only queries (market lists, portfolio, leaderboard).
 */
import "server-only";

import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";
import ws from "ws";

import { readEnv } from "@/lib/config/env";

import * as schema from "./schema";
import type { Db } from "./types";

neonConfig.webSocketConstructor = ws;

function databaseUrl(): string {
  const url = readEnv().DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set; markets are switched off.");
  return url;
}

export async function withWriteDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: databaseUrl() });
  try {
    return await fn(drizzleWs({ client: pool, schema }));
  } finally {
    await pool.end();
  }
}

let readDb: Db | undefined;

export function getReadDb(): Db {
  readDb ??= drizzleHttp({ client: neon(databaseUrl()), schema });
  return readDb;
}
