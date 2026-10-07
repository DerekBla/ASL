# Integration Spec: Neon Postgres + Drizzle ORM

**Status**: implemented
**Last updated**: 2026-10-07
**Pinned**: drizzle-orm 0.45.3, drizzle-kit 0.31.11, @neondatabase/serverless 1.2.0, ws 8.22.0; tests use @electric-sql/pglite 0.5.8
**Packages**: `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `ws` (Node WebSocket for the Pool); pin exact versions at scaffold time and record them in `references/neon-reference.md`
**Auth**: `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED` (migrations), `DATABASE_URL_TEST` (concurrency tests)

## Why

Postgres gives real transactions, row locks, `numeric`, and `CHECK` constraints, which the
ledger depends on. Neon is serverless Postgres with a free tier and Vercel integration.
Neon **branches** give a throwaway database per test run or preview deploy. Drizzle is typed
SQL with migrations and no runtime magic.

## Two drivers, two jobs

| Driver | Import | Transactions | Use for |
|---|---|---|---|
| WebSocket Pool | `drizzle-orm/neon-serverless` + `Pool` | Interactive (`db.transaction(async tx => …)`) | **All ledger writes** |
| HTTP | `drizzle-orm/neon-http` + `neon()` | Non-interactive batch only | Read-only queries (market lists, leaderboard) |

The HTTP driver can't run a transaction whose later statements depend on earlier reads
(lock → read q → compute → write). Using it in the ledger is a correctness bug, not a
performance choice. `code-checklist.yml` money-2 covers this.

```ts
// lib/db/client.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import ws from "ws";
import { env } from "@/lib/config/env";
import * as schema from "./schema";

neonConfig.webSocketConstructor = ws;               // Node runtime only (never Edge for ledger)

export const pool = drizzleWs(new Pool({ connectionString: env.DATABASE_URL }), { schema });
export const readDb = drizzleHttp(neon(env.DATABASE_URL), { schema });
```

## Schema and migrations

- Schema lives in `lib/db/schema.ts`, mirroring `Docs/foundation-specs/ledger.md`.
- `numeric` columns: `numeric("balance", { precision: 18, scale: 6 })`. Values come back as
  **strings**. Convert in the ledger service only.
- `CHECK` constraints and partial unique indexes go in migrations if Drizzle can't express them.
- `pnpm db:generate` (drizzle-kit generate) → review SQL → `pnpm db:migrate` on
  `DATABASE_URL_UNPOOLED`.
- Never edit an applied migration. Add a new one.

## Error mapping

| Postgres code | Meaning | Internal code | Handling |
|---|---|---|---|
| `23514` | CHECK violation (e.g. negative balance) | `INSUFFICIENT_FUNDS` / `INSUFFICIENT_SHARES` | Should be caught earlier by app checks; treat as a bug signal and log |
| `23505` | Unique violation on `(user_id, idempotency_key)` | — | Fetch and return the original trade |
| `40001` | Serialization failure | — | Retry the transaction (max 3, jittered) |
| `40P01` | Deadlock | — | Retry; investigate lock order if it recurs |
| `57014` / timeouts | Statement timeout | `TEMPORARY_FAILURE` | Return error; client may retry with same key |

## Known gotchas

- The WebSocket Pool must be created per request in some serverless runtimes. Follow the
  Neon docs for Vercel functions at the pinned version and record the outcome here.
- Neon free-tier compute auto-suspends; the first query after idle is slow. Fine for this site.
- Drizzle `bigserial` columns are `bigint` in TS; brand them (`MarketId`) at the service edge.
