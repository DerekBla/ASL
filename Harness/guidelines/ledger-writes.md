# Ledger Writes — StarCoins

Read `Docs/foundation-specs/ledger.md` first. This guideline is the "how" for code inside
`lib/services/ledger/`.

## Shape of every ledger operation

```ts
// lib/services/ledger/execute-trade.ts
import { sql } from "drizzle-orm";
import { pool } from "@/lib/db/client";           // neon-serverless Pool (WebSocket), NOT neon-http
import * as lmsr from "@/lib/market/lmsr";

export async function executeTrade(input: TradeInput): Promise<Result<TradeReceipt, LedgerError>> {
  return pool.transaction(async (tx) => {
    const existing = await findByIdempotencyKey(tx, input.userId, input.idempotencyKey);
    if (existing) return ok(existing);

    const market = await lockMarket(tx, input.marketId);         // SELECT … FOR UPDATE
    if (!market || market.status !== "open") return err("MARKET_CLOSED");
    if (market.closesAtPassed) return err("MARKET_CLOSED");      // compared with now() in SQL

    const q = await loadQuantities(tx, market.id);                // ordered by idx
    const account = await lockAccount(tx, input.userId);         // SELECT … FOR UPDATE

    const quote = quoteFor(market.b, q, input);                    // lmsr.* only
    // …checks: balance, position size, maxCost / minProceeds, price sanity

    await insertTrade(tx, /* … */);
    await updateQuantity(tx, market.id, input.outcomeIdx, quote.shares);
    await upsertPosition(tx, /* … */);
    await insertLedgerEntry(tx, { accountId: account.id, amount: -quote.cost, reason: "trade" });
    await updateBalance(tx, account.id, -quote.cost);
    return ok(receipt);
  });
}
```

## Rules

- **Lock order**: market row, then account rows by ascending id. Never the reverse.
- **Read q inside the transaction**, after the market lock. A quote computed before the
  lock is stale by definition.
- **Time** comes from the database (`now()`), not `Date.now()`.
- **Conversions**: `numeric` columns arrive as strings from Drizzle. Convert with one helper
  (`toNumber`, `toNumericString`) at the edge of this module. Store with 6 decimals.
- **Rounding**: buys `roundCostUp`, sells/payouts `roundProceedsDown`. Rounding never favors the user.
- **Errors**: return typed `LedgerError` codes (`MARKET_CLOSED`, `INSUFFICIENT_FUNDS`,
  `INSUFFICIENT_SHARES`, `SLIPPAGE`, `NOT_FOUND`). Throwing aborts the transaction, which is
  fine for unexpected faults. Expected business rejections are returned, not thrown.
- **Serialization failures** (`40001`) and deadlocks (`40P01`): retry the whole transaction
  up to 3 times with jitter. Idempotency makes that safe.
- **No `neon-http`** in this module. It can't run interactive transactions.

## Tests required for any ledger change

1. Happy path for the operation.
2. Each rejection code.
3. Idempotent replay returns the same receipt and changes nothing.
4. Invariant check helper (`assertLedgerInvariants(db)`) passes after every test.
5. The concurrency test in `ledger.md` if lock or ordering code changed.
