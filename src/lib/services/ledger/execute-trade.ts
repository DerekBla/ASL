import { and, asc, eq, sql } from "drizzle-orm";

import * as lmsr from "@/lib/market/lmsr";
import { accounts, marketOutcomes, markets, positions, trades } from "@/lib/db/schema";
import type { Db, Tx } from "@/lib/db/types";
import { marketId as toMarketId, tradeId as toTradeId } from "@/lib/types/ids";
import type { MarketId, TradeId, UserId } from "@/lib/types/ids";
import { err, ok } from "@/lib/types/result";
import type { LedgerError, Result } from "@/lib/types/result";

import { lockAccounts, post } from "./accounts";
import { floorShares, toNumber, toNumeric, toPrice } from "./numeric";
import { pgErrorCode, withRetry } from "./retry";

export type TradeMode = "buy_spend" | "buy_shares" | "sell_shares";

export type TradeInput = {
  userId: UserId;
  marketId: MarketId;
  outcomeIdx: number;
  mode: TradeMode;
  /** Credits to spend (buy_spend) or shares to buy or sell. */
  amount: number;
  /** Slippage bound for buys: reject if the server's cost is higher. */
  maxCost?: number | undefined;
  /** Slippage bound for sells: reject if the server's proceeds are lower. */
  minProceeds?: number | undefined;
  idempotencyKey: string;
};

export type TradeReceipt = {
  tradeId: TradeId;
  marketId: MarketId;
  marketSlug: string;
  outcomeIdx: number;
  /** + bought, - sold. */
  shares: number;
  /** + paid, - received. */
  cost: number;
  priceBefore: number;
  priceAfter: number;
  /** Balance and prices now (after this trade, or as they stand when a retry is replayed). */
  balance: number;
  prices: number[];
  replayed: boolean;
};

/** Prices may not be pushed beyond these (ledger.md, executeTrade step 6). */
const PRICE_FLOOR = 0.001;
const PRICE_CEILING = 0.999;
const EPSILON = 1e-9;

async function currentState(
  tx: Tx,
  market: number,
  user: UserId,
): Promise<{ balance: number; prices: number[]; b: number; slug: string }> {
  const [m] = await tx
    .select({ b: markets.b, slug: markets.slug })
    .from(markets)
    .where(eq(markets.id, market));
  const q = await tx
    .select({ q: marketOutcomes.q })
    .from(marketOutcomes)
    .where(eq(marketOutcomes.marketId, market))
    .orderBy(asc(marketOutcomes.idx));
  const [account] = await tx
    .select({ balance: accounts.balance })
    .from(accounts)
    .where(eq(accounts.userId, user));
  if (!m || !account) throw new Error("market or account missing while replaying a trade");
  const b = toNumber(m.b);
  return {
    balance: toNumber(account.balance),
    prices: lmsr.prices(
      b,
      q.map((r) => toNumber(r.q)),
    ),
    b,
    slug: m.slug,
  };
}

async function replay(tx: Tx, trade: typeof trades.$inferSelect): Promise<TradeReceipt> {
  const state = await currentState(tx, trade.marketId, trade.userId as UserId);
  return {
    tradeId: toTradeId(trade.id),
    marketId: toMarketId(trade.marketId),
    marketSlug: state.slug,
    outcomeIdx: trade.outcomeIdx,
    shares: toNumber(trade.shares),
    cost: toNumber(trade.cost),
    priceBefore: toNumber(trade.priceBefore),
    priceAfter: toNumber(trade.priceAfter),
    balance: state.balance,
    prices: state.prices,
    replayed: true,
  };
}

async function findExisting(
  tx: Tx,
  input: TradeInput,
): Promise<typeof trades.$inferSelect | undefined> {
  const [existing] = await tx
    .select()
    .from(trades)
    .where(and(eq(trades.userId, input.userId), eq(trades.idempotencyKey, input.idempotencyKey)));
  return existing;
}

/**
 * Buys or sells shares in one outcome. One transaction: idempotency check, lock the market,
 * read q, lock the account, quote with lmsr.ts, check, then write the trade, q, position,
 * ledger entry and balance (Docs/foundation-specs/ledger.md, executeTrade).
 */
export async function executeTrade(
  db: Db,
  input: TradeInput,
): Promise<Result<TradeReceipt, LedgerError>> {
  if (!Number.isFinite(input.amount) || input.amount <= 0 || !input.idempotencyKey) {
    return err({ code: "INVALID_TRADE" });
  }
  try {
    return await withRetry(() => db.transaction((tx) => trade(tx, input)));
  } catch (error) {
    // Two retries of the same request racing: the loser hits the unique key. Return the winner.
    if (pgErrorCode(error) === "23505") {
      return db.transaction(async (tx) => {
        const existing = await findExisting(tx, input);
        return existing ? ok(await replay(tx, existing)) : err({ code: "INVALID_TRADE" as const });
      });
    }
    throw error;
  }
}

async function trade(tx: Tx, input: TradeInput): Promise<Result<TradeReceipt, LedgerError>> {
  const existing = await findExisting(tx, input);
  if (existing) return ok(await replay(tx, existing));

  const [market] = await tx
    .select({
      id: markets.id,
      slug: markets.slug,
      b: markets.b,
      status: markets.status,
      pastClose: sql<boolean>`${markets.closesAt} <= now()`,
    })
    .from(markets)
    .where(eq(markets.id, input.marketId))
    .for("update");
  if (!market) return err({ code: "NOT_FOUND" });
  if (market.status !== "open" || market.pastClose) return err({ code: "MARKET_CLOSED" });

  const outcomes = await tx
    .select({ idx: marketOutcomes.idx, q: marketOutcomes.q })
    .from(marketOutcomes)
    .where(eq(marketOutcomes.marketId, market.id))
    .orderBy(asc(marketOutcomes.idx));
  const i = input.outcomeIdx;
  if (!Number.isInteger(i) || i < 0 || i >= outcomes.length) return err({ code: "INVALID_TRADE" });
  const q = outcomes.map((o) => toNumber(o.q));
  const b = toNumber(market.b);

  const [account] = await tx
    .select({ id: accounts.id, balance: accounts.balance })
    .from(accounts)
    .where(eq(accounts.userId, input.userId));
  if (!account) return err({ code: "NOT_FOUND", message: "No account for this user." });
  await lockAccounts(tx, [account.id]);
  const balance = toNumber(
    (
      await tx
        .select({ balance: accounts.balance })
        .from(accounts)
        .where(eq(accounts.id, account.id))
    )[0]?.balance ?? "0",
  );

  // Quote on the server from the locked q. Client numbers are only slippage bounds.
  let shares: number;
  let cost: number;
  if (input.mode === "sell_shares") {
    shares = floorShares(input.amount);
    if (shares <= 0) return err({ code: "INVALID_TRADE" });
    const [position] = await tx
      .select({ shares: positions.shares })
      .from(positions)
      .where(
        and(
          eq(positions.userId, input.userId),
          eq(positions.marketId, market.id),
          eq(positions.outcomeIdx, i),
        ),
      );
    if (shares > toNumber(position?.shares ?? "0") + EPSILON)
      return err({ code: "INSUFFICIENT_SHARES" });
    const proceeds = lmsr.roundProceedsDown(-lmsr.tradeCost(b, q, i, -shares));
    if (input.minProceeds !== undefined && proceeds + EPSILON < input.minProceeds)
      return err({ code: "SLIPPAGE" });
    shares = -shares;
    cost = -proceeds;
  } else {
    if (input.mode === "buy_spend") {
      if (input.amount > balance + EPSILON) return err({ code: "INSUFFICIENT_FUNDS" });
      shares = floorShares(lmsr.sharesForSpend(b, q, i, input.amount));
    } else {
      shares = floorShares(input.amount);
    }
    if (shares <= 0) return err({ code: "INVALID_TRADE" });
    cost = lmsr.roundCostUp(lmsr.tradeCost(b, q, i, shares));
    // Rounding the cost up can land a micro-credit above the spend. Trim shares rather than
    // undercharge: rounding never favours the trader.
    while (input.mode === "buy_spend" && cost > input.amount + EPSILON && shares > 1e-6) {
      shares = floorShares(shares - 1e-6);
      cost = lmsr.roundCostUp(lmsr.tradeCost(b, q, i, shares));
    }
    if (cost > balance + EPSILON) return err({ code: "INSUFFICIENT_FUNDS" });
    if (input.maxCost !== undefined && cost > input.maxCost + EPSILON)
      return err({ code: "SLIPPAGE" });
  }

  const priceBefore = lmsr.price(b, q, i);
  const after = lmsr.applyTrade(q, i, shares);
  const priceAfter = lmsr.price(b, after, i);
  if (priceAfter < PRICE_FLOOR || priceAfter > PRICE_CEILING) return err({ code: "PRICE_LIMIT" });

  const [row] = await tx
    .insert(trades)
    .values({
      marketId: market.id,
      userId: input.userId,
      outcomeIdx: i,
      shares: toNumeric(shares),
      cost: toNumeric(cost),
      priceBefore: toPrice(priceBefore),
      priceAfter: toPrice(priceAfter),
      idempotencyKey: input.idempotencyKey,
    })
    .returning({ id: trades.id });
  if (!row) throw new Error("trade insert returned nothing");

  await tx
    .update(marketOutcomes)
    .set({ q: sql`${marketOutcomes.q} + ${toNumeric(shares)}::numeric` })
    .where(and(eq(marketOutcomes.marketId, market.id), eq(marketOutcomes.idx, i)));
  const positionDelta = {
    shares: sql`${positions.shares} + ${toNumeric(shares)}::numeric`,
    costBasis: sql`${positions.costBasis} + ${toNumeric(cost)}::numeric`,
  };
  if (shares > 0) {
    await tx
      .insert(positions)
      .values({
        userId: input.userId,
        marketId: market.id,
        outcomeIdx: i,
        shares: toNumeric(shares),
        costBasis: toNumeric(cost),
      })
      .onConflictDoUpdate({
        target: [positions.userId, positions.marketId, positions.outcomeIdx],
        set: positionDelta,
      });
  } else {
    // A sell updates the existing row. (An upsert would fail: Postgres checks the proposed
    // insert row, with its negative shares, against no_naked_shorts before resolving it.)
    await tx
      .update(positions)
      .set(positionDelta)
      .where(
        and(
          eq(positions.userId, input.userId),
          eq(positions.marketId, market.id),
          eq(positions.outcomeIdx, i),
        ),
      );
  }
  const newBalance = await post(tx, {
    accountId: account.id,
    amount: -cost,
    reason: "trade",
    marketId: market.id,
    tradeId: row.id,
  });

  return ok({
    tradeId: toTradeId(row.id),
    marketId: toMarketId(market.id),
    marketSlug: market.slug,
    outcomeIdx: i,
    shares,
    cost,
    priceBefore,
    priceAfter,
    balance: newBalance,
    prices: lmsr.prices(b, after),
    replayed: false,
  });
}
