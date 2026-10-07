import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";

import * as lmsr from "@/lib/market/lmsr";
import { accounts, marketOutcomes, markets, positions, trades } from "@/lib/db/schema";
import type { Db, Tx } from "@/lib/db/types";
import type { MarketId, UserId } from "@/lib/types/ids";
import { err, ok } from "@/lib/types/result";
import type { LedgerError, Result } from "@/lib/types/result";

import { ensureHouseAccount, lockAccounts, post } from "./accounts";
import { toNumber, toNumeric } from "./numeric";
import { withRetry } from "./retry";

export type Settlement = { paidOut: number; houseDelta: number; users: number };

async function lockOpenMarket(tx: Tx, id: MarketId): Promise<Result<{ id: number }, LedgerError>> {
  const [market] = await tx
    .select({ id: markets.id, status: markets.status })
    .from(markets)
    .where(eq(markets.id, id))
    .for("update");
  if (!market) return err({ code: "NOT_FOUND" });
  if (market.status === "resolved" || market.status === "voided")
    return err({ code: "ALREADY_SETTLED" });
  return ok({ id: market.id });
}

/** Net credits users paid into this market: the sum of every trade's cost. */
async function tradeRevenue(tx: Tx, market: number): Promise<number> {
  const [row] = await tx
    .select({ total: sql<string>`coalesce(sum(${trades.cost}), 0)` })
    .from(trades)
    .where(eq(trades.marketId, market));
  return toNumber(row?.total ?? "0");
}

/** Account ids for these users, plus the house, locked in ascending order. */
async function lockParticipants(
  tx: Tx,
  userIds: readonly string[],
): Promise<{ house: number; byUser: Map<string, number> }> {
  const house = await ensureHouseAccount(tx);
  const rows = userIds.length
    ? await tx
        .select({ id: accounts.id, userId: accounts.userId })
        .from(accounts)
        .where(inArray(accounts.userId, [...userIds]))
    : [];
  await lockAccounts(tx, [house, ...rows.map((r) => r.id)]);
  return { house, byUser: new Map(rows.map((r) => [r.userId ?? "", r.id])) };
}

/**
 * Pays 1 credit per winning share (rounded down), charges the house the market maker's result
 * so conservation holds, and marks the market resolved. Once only.
 */
export async function resolveMarket(
  db: Db,
  input: { marketId: MarketId; winningIdx: number; note: string; adminId: UserId },
): Promise<Result<Settlement, LedgerError>> {
  return withRetry(() =>
    db.transaction(async (tx) => {
      const market = await lockOpenMarket(tx, input.marketId);
      if ("error" in market) return market;
      const outcomes = await tx
        .select({ idx: marketOutcomes.idx })
        .from(marketOutcomes)
        .where(eq(marketOutcomes.marketId, market.data.id))
        .orderBy(asc(marketOutcomes.idx));
      if (!outcomes.some((o) => o.idx === input.winningIdx)) {
        return err({
          code: "INVALID_MARKET" as const,
          message: "That outcome isn't in this market.",
        });
      }
      const winners = await tx
        .select({ userId: positions.userId, shares: positions.shares })
        .from(positions)
        .where(
          and(
            eq(positions.marketId, market.data.id),
            eq(positions.outcomeIdx, input.winningIdx),
            gt(positions.shares, "0"),
          ),
        )
        .orderBy(asc(positions.userId));
      const { house, byUser } = await lockParticipants(
        tx,
        winners.map((w) => w.userId),
      );
      let paidOut = 0;
      for (const w of winners) {
        const payout = lmsr.roundProceedsDown(toNumber(w.shares));
        const account = byUser.get(w.userId);
        if (account === undefined || payout <= 0) continue;
        await post(tx, {
          accountId: account,
          amount: payout,
          reason: "payout",
          marketId: market.data.id,
        });
        paidOut += payout;
      }
      const houseDelta = (await tradeRevenue(tx, market.data.id)) - paidOut;
      if (Math.abs(houseDelta) >= 1e-6) {
        await post(tx, {
          accountId: house,
          amount: houseDelta,
          reason: "subsidy",
          marketId: market.data.id,
          note: "market maker result",
        });
      }
      await tx
        .update(markets)
        .set({
          status: "resolved",
          resolvedOutcome: input.winningIdx,
          resolutionNote: input.note,
          resolvedAt: sql`now()`,
        })
        .where(eq(markets.id, market.data.id));
      return ok({ paidOut, houseDelta, users: winners.length });
    }),
  );
}

/**
 * Cancels a market: refunds each user's net credits in (never less than zero; a user who
 * already sold at a profit keeps it), zeroes positions, house absorbs the rest.
 */
export async function voidMarket(
  db: Db,
  input: { marketId: MarketId; note: string; adminId: UserId },
): Promise<Result<Settlement, LedgerError>> {
  return withRetry(() =>
    db.transaction(async (tx) => {
      const market = await lockOpenMarket(tx, input.marketId);
      if ("error" in market) return market;
      const nets = await tx
        .select({ userId: positions.userId, net: sql<string>`sum(${positions.costBasis})` })
        .from(positions)
        .where(eq(positions.marketId, market.data.id))
        .groupBy(positions.userId)
        .orderBy(asc(positions.userId));
      const { house, byUser } = await lockParticipants(
        tx,
        nets.map((n) => n.userId),
      );
      let paidOut = 0;
      for (const n of nets) {
        const refund = Math.max(0, lmsr.roundProceedsDown(toNumber(n.net)));
        const account = byUser.get(n.userId);
        if (account === undefined || refund <= 0) continue;
        await post(tx, {
          accountId: account,
          amount: refund,
          reason: "refund",
          marketId: market.data.id,
        });
        paidOut += refund;
      }
      await tx
        .update(positions)
        .set({ shares: toNumeric(0), costBasis: toNumeric(0) })
        .where(eq(positions.marketId, market.data.id));
      const houseDelta = (await tradeRevenue(tx, market.data.id)) - paidOut;
      if (Math.abs(houseDelta) >= 1e-6) {
        await post(tx, {
          accountId: house,
          amount: houseDelta,
          reason: "subsidy",
          marketId: market.data.id,
          note: "void",
        });
      }
      await tx
        .update(markets)
        .set({ status: "voided", resolutionNote: input.note, resolvedAt: sql`now()` })
        .where(eq(markets.id, market.data.id));
      return ok({ paidOut, houseDelta, users: nets.length });
    }),
  );
}
