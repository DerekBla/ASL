/**
 * Read-only market queries: lists, market detail with live prices, portfolios, leaderboard.
 * Never writes (money-2). Prices always come from lmsr.ts applied to the stored q (money-4).
 * Every view is plain JSON so it can cross to the browser for polling.
 */
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import * as lmsr from "@/lib/market/lmsr";
import { accounts, marketOutcomes, markets, positions, trades, users } from "@/lib/db/schema";
import type { DbOrTx } from "@/lib/db/types";
import type { UserId } from "@/lib/types/ids";

export type MarketStatus = "open" | "closed" | "resolved" | "voided";

export type OutcomeView = { idx: number; label: string; player: string | null; price: number };

export type MarketSummary = {
  id: number;
  slug: string;
  question: string;
  /** "open" also requires closesAt in the future; a market past its time reads as "closed". */
  status: MarketStatus;
  closesAt: string;
  season: number | null;
  outcomes: OutcomeView[];
  resolvedOutcome: number | null;
  /** Total minerals traded, buys and sells. */
  volume: number;
  traders: number;
};

export type TradeView = {
  id: number;
  at: string;
  trader: string;
  outcomeIdx: number;
  shares: number;
  cost: number;
  priceAfter: number;
};

export type MarketView = MarketSummary & {
  description: string;
  b: number;
  resolutionNote: string | null;
  resolvedAt: string | null;
  recentTrades: TradeView[];
  /** Price of each outcome after every trade, oldest first, starting from the opening price. */
  history: { at: string; prices: number[] }[];
};

export type PositionView = {
  marketSlug: string;
  question: string;
  status: MarketStatus;
  outcomeIdx: number;
  outcomeLabel: string;
  shares: number;
  costBasis: number;
  /** Current price of the outcome (0 or 1 once resolved). */
  price: number;
  /** shares × price: what the position is worth if marked to market now. */
  value: number;
};

export type Portfolio = {
  userId: string;
  displayName: string;
  isAdmin: boolean;
  balance: number;
  positions: PositionView[];
  /** balance + value of open positions. */
  netWorth: number;
  trades: (TradeView & { marketSlug: string; outcomeLabel: string })[];
};

export type LeaderboardRow = {
  rank: number;
  userId: string;
  displayName: string;
  balance: number;
  positionsValue: number;
  netWorth: number;
};

const num = (v: string | number | null | undefined): number => Number(v ?? 0);

type OutcomeRow = {
  marketId: number;
  idx: number;
  label: string;
  player: string | null;
  q: string;
  q0: string;
};

async function outcomesFor(db: DbOrTx, ids: number[]): Promise<Map<number, OutcomeRow[]>> {
  const out = new Map<number, OutcomeRow[]>();
  if (ids.length === 0) return out;
  const rows = await db
    .select()
    .from(marketOutcomes)
    .where(inArray(marketOutcomes.marketId, ids))
    .orderBy(asc(marketOutcomes.marketId), asc(marketOutcomes.idx));
  for (const r of rows) out.set(r.marketId, [...(out.get(r.marketId) ?? []), r]);
  return out;
}

/** Current prices; a resolved market shows 1 for the winner and 0 for the rest. */
function pricesOf(
  market: { b: string; status: MarketStatus; resolvedOutcome: number | null },
  rows: OutcomeRow[],
): number[] {
  if (market.status === "resolved" && market.resolvedOutcome !== null) {
    return rows.map((r) => (r.idx === market.resolvedOutcome ? 1 : 0));
  }
  return rows.length >= 2
    ? lmsr.prices(
        num(market.b),
        rows.map((r) => num(r.q)),
      )
    : rows.map(() => 0);
}

function effectiveStatus(status: MarketStatus, pastClose: boolean): MarketStatus {
  return status === "open" && pastClose ? "closed" : status;
}

const marketColumns = {
  id: markets.id,
  slug: markets.slug,
  question: markets.question,
  description: markets.description,
  status: markets.status,
  closesAt: markets.closesAt,
  season: markets.season,
  b: markets.b,
  resolvedOutcome: markets.resolvedOutcome,
  resolutionNote: markets.resolutionNote,
  resolvedAt: markets.resolvedAt,
  pastClose: sql<boolean>`${markets.closesAt} <= now()`,
  // Correlated subqueries spelled out with an alias: Drizzle leaves column names unqualified
  // here, so "id" would bind to trades.id instead of markets.id.
  volume: sql<string>`(select coalesce(sum(abs(t.cost)), 0) from trades t where t.market_id = "markets"."id")`,
  traders: sql<number>`(select count(distinct t.user_id)::int from trades t where t.market_id = "markets"."id")`,
};

type MarketRow = {
  id: number;
  slug: string;
  question: string;
  status: MarketStatus;
  closesAt: Date;
  season: number | null;
  b: string;
  resolvedOutcome: number | null;
  pastClose: boolean;
  volume: string;
  traders: number;
};

function summarize(m: MarketRow, rows: OutcomeRow[]): MarketSummary {
  const prices = pricesOf(m, rows);
  return {
    id: m.id,
    slug: m.slug,
    question: m.question,
    status: effectiveStatus(m.status, m.pastClose),
    closesAt: m.closesAt.toISOString(),
    season: m.season,
    resolvedOutcome: m.resolvedOutcome,
    outcomes: rows.map((r, i) => ({
      idx: r.idx,
      label: r.label,
      player: r.player,
      price: prices[i] ?? 0,
    })),
    volume: num(m.volume),
    traders: num(m.traders),
  };
}

/** Every market: open ones first (soonest to close), then the rest, newest first. */
export async function listMarkets(db: DbOrTx): Promise<MarketSummary[]> {
  const rows = await db.select(marketColumns).from(markets).orderBy(desc(markets.closesAt));
  const outcomes = await outcomesFor(
    db,
    rows.map((r) => r.id),
  );
  const all = rows.map((m) => summarize(m, outcomes.get(m.id) ?? []));
  const open = all
    .filter((m) => m.status === "open")
    .sort((a, b) => a.closesAt.localeCompare(b.closesAt));
  return [...open, ...all.filter((m) => m.status !== "open")];
}

export async function getMarketView(db: DbOrTx, slug: string): Promise<MarketView | undefined> {
  const [m] = await db.select(marketColumns).from(markets).where(eq(markets.slug, slug));
  if (!m) return undefined;
  const rows = (await outcomesFor(db, [m.id])).get(m.id) ?? [];
  const tradeRows = await db
    .select({
      id: trades.id,
      at: trades.createdAt,
      trader: users.displayName,
      outcomeIdx: trades.outcomeIdx,
      shares: trades.shares,
      cost: trades.cost,
      priceAfter: trades.priceAfter,
    })
    .from(trades)
    .innerJoin(users, eq(users.id, trades.userId))
    .where(eq(trades.marketId, m.id))
    .orderBy(asc(trades.id));

  // Replay trades from q0 to get every outcome's price after each one.
  const b = num(m.b);
  let q = rows.map((r) => num(r.q0));
  const history: { at: string; prices: number[] }[] =
    rows.length >= 2 ? [{ at: m.closesAt.toISOString(), prices: lmsr.prices(b, q) }] : [];
  for (const t of tradeRows) {
    q = lmsr.applyTrade(q, t.outcomeIdx, num(t.shares));
    history.push({ at: t.at.toISOString(), prices: lmsr.prices(b, q) });
  }
  const first = tradeRows[0];
  if (history[0]) history[0].at = first ? first.at.toISOString() : new Date().toISOString();

  return {
    ...summarize(m, rows),
    description: m.description,
    b,
    resolutionNote: m.resolutionNote,
    resolvedAt: m.resolvedAt?.toISOString() ?? null,
    history,
    recentTrades: tradeRows
      .slice(-25)
      .reverse()
      .map((t) => ({
        id: t.id,
        at: t.at.toISOString(),
        trader: t.trader,
        outcomeIdx: t.outcomeIdx,
        shares: num(t.shares),
        cost: num(t.cost),
        priceAfter: num(t.priceAfter),
      })),
  };
}

/** A user's balance, positions marked to market, and trade history. */
export async function getPortfolio(db: DbOrTx, user: UserId): Promise<Portfolio | undefined> {
  const [u] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      isAdmin: users.isAdmin,
      balance: accounts.balance,
    })
    .from(users)
    .innerJoin(accounts, eq(accounts.userId, users.id))
    .where(eq(users.id, user));
  if (!u) return undefined;

  const posRows = await db
    .select({
      marketId: positions.marketId,
      outcomeIdx: positions.outcomeIdx,
      shares: positions.shares,
      costBasis: positions.costBasis,
      slug: markets.slug,
      question: markets.question,
      status: markets.status,
      b: markets.b,
      resolvedOutcome: markets.resolvedOutcome,
      pastClose: sql<boolean>`${markets.closesAt} <= now()`,
    })
    .from(positions)
    .innerJoin(markets, eq(markets.id, positions.marketId))
    .where(and(eq(positions.userId, user), sql`${positions.shares} > 0`))
    .orderBy(desc(markets.closesAt), asc(positions.outcomeIdx));
  const outcomes = await outcomesFor(db, [...new Set(posRows.map((p) => p.marketId))]);

  const positionsView: PositionView[] = posRows.map((p) => {
    const rows = outcomes.get(p.marketId) ?? [];
    const prices = pricesOf(p, rows);
    const at = rows.findIndex((r) => r.idx === p.outcomeIdx);
    const price = prices[at] ?? 0;
    const shares = num(p.shares);
    return {
      marketSlug: p.slug,
      question: p.question,
      status: effectiveStatus(p.status, p.pastClose),
      outcomeIdx: p.outcomeIdx,
      outcomeLabel: rows[at]?.label ?? `Outcome ${p.outcomeIdx + 1}`,
      shares,
      costBasis: num(p.costBasis),
      price,
      value: shares * price,
    };
  });

  const tradeRows = await db
    .select({
      id: trades.id,
      at: trades.createdAt,
      outcomeIdx: trades.outcomeIdx,
      shares: trades.shares,
      cost: trades.cost,
      priceAfter: trades.priceAfter,
      slug: markets.slug,
      label: marketOutcomes.label,
    })
    .from(trades)
    .innerJoin(markets, eq(markets.id, trades.marketId))
    .innerJoin(
      marketOutcomes,
      and(eq(marketOutcomes.marketId, trades.marketId), eq(marketOutcomes.idx, trades.outcomeIdx)),
    )
    .where(eq(trades.userId, user))
    .orderBy(desc(trades.id))
    .limit(100);

  const balance = num(u.balance);
  const openValue = positionsView
    .filter((p) => p.status === "open" || p.status === "closed")
    .reduce((s, p) => s + p.value, 0);
  return {
    userId: u.id,
    displayName: u.displayName,
    isAdmin: u.isAdmin,
    balance,
    positions: positionsView,
    netWorth: balance + openValue,
    trades: tradeRows.map((t) => ({
      id: t.id,
      at: t.at.toISOString(),
      trader: u.displayName,
      outcomeIdx: t.outcomeIdx,
      shares: num(t.shares),
      cost: num(t.cost),
      priceAfter: num(t.priceAfter),
      marketSlug: t.slug,
      outcomeLabel: t.label,
    })),
  };
}

/** Everyone ranked by net worth: balance plus unsettled positions at current prices. */
export async function getLeaderboard(db: DbOrTx, limit = 100): Promise<LeaderboardRow[]> {
  const people = await db
    .select({ userId: users.id, displayName: users.displayName, balance: accounts.balance })
    .from(users)
    .innerJoin(accounts, eq(accounts.userId, users.id));
  const open = await db
    .select({
      userId: positions.userId,
      marketId: positions.marketId,
      outcomeIdx: positions.outcomeIdx,
      shares: positions.shares,
      b: markets.b,
      status: markets.status,
      resolvedOutcome: markets.resolvedOutcome,
    })
    .from(positions)
    .innerJoin(markets, eq(markets.id, positions.marketId))
    .where(and(sql`${positions.shares} > 0`, inArray(markets.status, ["open", "closed"])));
  const outcomes = await outcomesFor(db, [...new Set(open.map((p) => p.marketId))]);
  const value = new Map<string, number>();
  for (const p of open) {
    const rows = outcomes.get(p.marketId) ?? [];
    const price = pricesOf(p, rows)[rows.findIndex((r) => r.idx === p.outcomeIdx)] ?? 0;
    value.set(p.userId, (value.get(p.userId) ?? 0) + num(p.shares) * price);
  }
  return people
    .map((p) => {
      const positionsValue = value.get(p.userId) ?? 0;
      return {
        userId: p.userId,
        displayName: p.displayName,
        balance: num(p.balance),
        positionsValue,
        netWorth: num(p.balance) + positionsValue,
      };
    })
    .sort((a, b) => b.netWorth - a.netWorth || a.displayName.localeCompare(b.displayName))
    .slice(0, limit)
    .map((r, i) => ({ rank: i + 1, ...r }));
}
