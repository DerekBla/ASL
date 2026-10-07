// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { SIGNUP_GRANT_CREDITS } from "@/lib/config/site";
import type { Db } from "@/lib/db/types";
import { createMarket, ensureUser, executeTrade, resolveMarket } from "@/lib/services/ledger";
import { userId } from "@/lib/types/ids";
import type { MarketId, UserId } from "@/lib/types/ids";

import { createTestDb, makeAdmin } from "@/test/db";
import type { TestDb } from "@/test/db";
import { makeKey, makeMarketInput } from "@/test/factories/markets";

import { getLeaderboard, getMarketView, getPortfolio, listMarkets } from "../index";

let t: TestDb;
let db: Db;
let admin: UserId;

beforeAll(async () => {
  t = await createTestDb();
  db = t.db;
}, 60_000);
afterAll(async () => {
  await t.close();
});
beforeEach(async () => {
  await t.reset();
  admin = await makeAdmin(db);
});

async function market(
  overrides: Parameters<typeof makeMarketInput>[1] = {},
): Promise<{ id: MarketId; slug: string }> {
  const r = await createMarket(db, makeMarketInput(admin, overrides));
  if ("error" in r) throw new Error(r.error.code);
  return { id: r.data.marketId, slug: r.data.slug };
}

async function user(id: string): Promise<UserId> {
  await ensureUser(db, { userId: userId(id), displayName: id.toUpperCase() });
  return userId(id);
}

async function buy(u: UserId, m: MarketId, outcomeIdx: number, amount: number): Promise<number> {
  const r = await executeTrade(db, {
    userId: u,
    marketId: m,
    outcomeIdx,
    mode: "buy_spend",
    amount,
    idempotencyKey: makeKey(),
  });
  if ("error" in r) throw new Error(r.error.code);
  return r.data.cost;
}

describe("listMarkets", () => {
  it("lists open markets first, soonest closing first, and shows past-time markets as closed", async () => {
    const later = await market({ closesAt: new Date(Date.now() + 9 * 86400_000) });
    const sooner = await market({ closesAt: new Date(Date.now() + 86400_000) });
    const expired = await market({ closesAt: new Date(Date.now() - 1000) });
    const list = await listMarkets(db);
    expect(list.map((m) => m.slug)).toEqual([sooner.slug, later.slug, expired.slug]);
    expect(list.find((m) => m.slug === expired.slug)?.status).toBe("closed");
    expect(list[0]?.outcomes.map((o) => o.price)).toEqual([0.5, 0.5]);
  });
});

describe("getMarketView", () => {
  it("shows prices, volume, traders, recent trades and the price history", async () => {
    const m = await market();
    const a = await user("a");
    const b = await user("b");
    const c1 = await buy(a, m.id, 0, 5);
    const c2 = await buy(b, m.id, 1, 2);
    const view = await getMarketView(db, m.slug);
    expect(view?.outcomes[0]?.price).toBeGreaterThan(0.5);
    expect(view?.volume).toBeCloseTo(c1 + c2, 6);
    expect(view?.traders).toBe(2);
    expect(view?.recentTrades.map((r) => r.trader)).toEqual(["B", "A"]);
    expect(view?.history).toHaveLength(3);
    expect(view?.history[0]?.prices).toEqual([0.5, 0.5]);
    expect(await getMarketView(db, "missing")).toBeUndefined();
  });

  it("shows a resolved market at 100% for the winner", async () => {
    const m = await market();
    await resolveMarket(db, { marketId: m.id, winningIdx: 1, note: "Soulkey won", adminId: admin });
    const view = await getMarketView(db, m.slug);
    expect(view?.status).toBe("resolved");
    expect(view?.outcomes.map((o) => o.price)).toEqual([0, 1]);
    expect(view?.resolutionNote).toBe("Soulkey won");
  });
});

describe("getPortfolio", () => {
  it("marks open positions to market in the net worth", async () => {
    const m = await market();
    const a = await user("a");
    const cost = await buy(a, m.id, 0, 5);
    const p = await getPortfolio(db, a);
    expect(p?.balance).toBeCloseTo(SIGNUP_GRANT_CREDITS - cost, 6);
    expect(p?.positions).toHaveLength(1);
    const pos = p?.positions[0];
    expect(pos?.outcomeLabel).toBe("Rush");
    expect(pos?.value).toBeCloseTo((pos?.shares ?? 0) * (pos?.price ?? 0), 9);
    expect(p?.netWorth).toBeCloseTo((p?.balance ?? 0) + (pos?.value ?? 0), 9);
    expect(p?.trades).toHaveLength(1);
    expect(await getPortfolio(db, userId("nobody"))).toBeUndefined();
  });

  it("stops counting a position in net worth once it has been paid out", async () => {
    const m = await market();
    const a = await user("a");
    await buy(a, m.id, 0, 5);
    await resolveMarket(db, { marketId: m.id, winningIdx: 0, note: "", adminId: admin });
    const p = await getPortfolio(db, a);
    expect(p?.positions[0]?.status).toBe("resolved");
    expect(p?.netWorth).toBeCloseTo(p?.balance ?? -1, 9);
  });
});

describe("getLeaderboard", () => {
  it("ranks by balance plus open positions", async () => {
    const m = await market();
    const a = await user("a");
    await user("b");
    await buy(a, m.id, 0, 10);
    const board = await getLeaderboard(db);
    expect(board.map((r) => r.rank)).toEqual([1, 2]);
    const rowA = board.find((r) => r.displayName === "A");
    expect(rowA?.netWorth).toBeCloseTo((rowA?.balance ?? 0) + (rowA?.positionsValue ?? 0), 9);
    expect(board[0]?.netWorth).toBeGreaterThanOrEqual(board[1]?.netWorth ?? Infinity);
  });
});
