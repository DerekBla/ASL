// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as lmsr from "@/lib/market/lmsr";
import { SIGNUP_GRANT_CREDITS } from "@/lib/config/site";
import { accounts, marketOutcomes, markets, positions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { marketId, userId } from "@/lib/types/ids";
import type { MarketId, UserId } from "@/lib/types/ids";

import { createTestDb, makeAdmin } from "@/test/db";
import type { TestDb } from "@/test/db";
import { makeKey, makeMarketInput } from "@/test/factories/markets";

import {
  checkLedgerInvariants,
  closeMarket,
  createMarket,
  ensureUser,
  executeTrade,
  getBalance,
  grantCredits,
  resolveMarket,
  voidMarket,
} from "../index";
import type { TradeInput } from "../index";

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
afterEach(async () => {
  expect(await checkLedgerInvariants(db)).toEqual([]);
});

async function newUser(id: string): Promise<UserId> {
  const u = userId(id);
  await ensureUser(db, { userId: u, displayName: id });
  return u;
}

async function newMarket(overrides: Parameters<typeof makeMarketInput>[1] = {}): Promise<MarketId> {
  const result = await createMarket(db, makeMarketInput(admin, overrides));
  if ("error" in result) throw new Error(result.error.message ?? result.error.code);
  return result.data.marketId;
}

function trade(
  user: UserId,
  market: MarketId,
  overrides: Partial<TradeInput> = {},
): ReturnType<typeof executeTrade> {
  return executeTrade(db, {
    userId: user,
    marketId: market,
    outcomeIdx: 0,
    mode: "buy_spend",
    amount: 5,
    idempotencyKey: makeKey(),
    ...overrides,
  });
}

function data<T>(result: { data: T } | { error: { code: string } }): T {
  if ("error" in result) throw new Error(`expected success, got ${result.error.code}`);
  return result.data;
}

describe("ensureUser", () => {
  it("creates the account with the signup grant exactly once", async () => {
    const u = userId("user_a");
    const first = await ensureUser(db, { userId: u, displayName: "A" });
    const second = await ensureUser(db, { userId: u, displayName: "A again" });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.accountId).toBe(first.accountId);
    expect(await getBalance(db, u)).toBe(SIGNUP_GRANT_CREDITS);
  });

  it("funds grants from the house, so the house goes negative by the same amount", async () => {
    await newUser("user_a");
    await newUser("user_b");
    const [house] = await db.select().from(accounts).where(eq(accounts.isHouse, true));
    expect(Number(house?.balance)).toBe(-2 * SIGNUP_GRANT_CREDITS);
  });
});

describe("grantCredits", () => {
  it("adds credits to a user and refuses unknown users and bad amounts", async () => {
    const u = await newUser("user_a");
    expect(
      data(await grantCredits(db, { userId: u, amount: 25, reason: "periodic_grant" })).balance,
    ).toBe(125);
    expect(
      await grantCredits(db, { userId: userId("nobody"), amount: 5, reason: "periodic_grant" }),
    ).toEqual({
      error: { code: "NOT_FOUND" },
    });
    expect(await grantCredits(db, { userId: u, amount: -5, reason: "periodic_grant" })).toEqual({
      error: { code: "INVALID_TRADE" },
    });
  });
});

describe("createMarket", () => {
  it("opens at the clamped prior with C(q0) = 0", async () => {
    const id = await newMarket({ prior: [0.7, 0.3] });
    const q = (await db.select().from(marketOutcomes).where(eq(marketOutcomes.marketId, id))).map(
      (o) => Number(o.q),
    );
    const p = lmsr.prices(10, q);
    expect(p[0]).toBeCloseTo(lmsr.clampPrior([0.7, 0.3])[0] ?? 0, 4);
    expect(lmsr.cost(10, q)).toBeCloseTo(0, 4);
  });

  it("only lets admins create markets", async () => {
    const u = await newUser("user_a");
    const result = await createMarket(db, makeMarketInput(u));
    expect(result).toEqual({
      error: { code: "INVALID_MARKET", message: "Only admins can create markets." },
    });
  });

  it("rejects bad setups", async () => {
    const bad = [
      { slug: "Not A Slug" },
      { outcomes: [{ label: "Only one" }] },
      { outcomes: [{ label: "Same" }, { label: "same" }] },
      { b: 0 },
      { prior: [1] },
    ];
    for (const overrides of bad) {
      const result = await createMarket(db, makeMarketInput(admin, overrides));
      expect("error" in result && result.error.code).toBe("INVALID_MARKET");
    }
    await newMarket({ slug: "taken" });
    const dupe = await createMarket(db, makeMarketInput(admin, { slug: "taken" }));
    expect("error" in dupe && dupe.error.message).toBe("That slug is already used.");
  });
});

describe("executeTrade", () => {
  it("buys by spend: charges at most the spend, moves the price, records everything", async () => {
    const u = await newUser("user_a");
    const m = await newMarket();
    const r = data(await trade(u, m, { amount: 5.1 }));
    expect(r.cost).toBeGreaterThan(5);
    expect(r.cost).toBeLessThanOrEqual(5.1);
    expect(r.priceBefore).toBeCloseTo(0.5, 6);
    expect(r.priceAfter).toBeCloseTo(0.7, 2); // ledger.md: ~5 credits moves a 50/50 b=10 market to ~70%
    expect(r.balance).toBeCloseTo(100 - r.cost, 6);
    expect(r.prices.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    const [pos] = await db.select().from(positions).where(eq(positions.userId, u));
    expect(Number(pos?.shares)).toBeCloseTo(r.shares, 6);
  });

  it("buys an exact number of shares, rounding cost up", async () => {
    const u = await newUser("user_a");
    const m = await newMarket();
    const r = data(await trade(u, m, { mode: "buy_shares", amount: 3 }));
    expect(r.shares).toBe(3);
    expect(r.cost).toBeGreaterThanOrEqual(lmsr.tradeCost(10, [0, 0], 0, 3));
  });

  it("sells shares back for less than they cost (rounding never favours the trader)", async () => {
    const u = await newUser("user_a");
    const m = await newMarket();
    const bought = data(await trade(u, m, { mode: "buy_shares", amount: 4 }));
    const sold = data(await trade(u, m, { mode: "sell_shares", amount: 4 }));
    expect(sold.shares).toBe(-4);
    expect(-sold.cost).toBeLessThanOrEqual(bought.cost);
    expect(sold.balance).toBeLessThanOrEqual(100);
    expect(sold.prices[0]).toBeCloseTo(0.5, 5);
  });

  it("replays a retried request instead of trading twice", async () => {
    const u = await newUser("user_a");
    const m = await newMarket();
    const key = makeKey();
    const first = data(await trade(u, m, { idempotencyKey: key }));
    const again = data(await trade(u, m, { idempotencyKey: key, amount: 50 }));
    expect(again.replayed).toBe(true);
    expect(again.tradeId).toBe(first.tradeId);
    expect(again.cost).toBe(first.cost);
    expect(await getBalance(db, u)).toBeCloseTo(100 - first.cost, 6);
  });

  it.each([
    ["INSUFFICIENT_FUNDS", { amount: 150 }],
    ["INSUFFICIENT_FUNDS", { mode: "buy_shares" as const, amount: 200 }],
    ["INSUFFICIENT_SHARES", { mode: "sell_shares" as const, amount: 1 }],
    ["SLIPPAGE", { mode: "buy_shares" as const, amount: 3, maxCost: 1 }],
    ["PRICE_LIMIT", { mode: "buy_shares" as const, amount: 80 }],
    ["INVALID_TRADE", { amount: 0 }],
    ["INVALID_TRADE", { outcomeIdx: 5 }],
  ])("rejects with %s", async (code, overrides) => {
    const u = await newUser("user_a");
    const m = await newMarket();
    expect(await trade(u, m, overrides)).toEqual({ error: expect.objectContaining({ code }) });
    expect(await getBalance(db, u)).toBe(100);
  });

  it("rejects a sell below the minimum proceeds", async () => {
    const u = await newUser("user_a");
    const m = await newMarket();
    data(await trade(u, m, { mode: "buy_shares", amount: 4 }));
    expect(await trade(u, m, { mode: "sell_shares", amount: 4, minProceeds: 100 })).toEqual({
      error: { code: "SLIPPAGE" },
    });
  });

  it("rejects trades on closed, expired, settled and unknown markets", async () => {
    const u = await newUser("user_a");
    const closed = await newMarket();
    data(await closeMarket(db, closed));
    expect(await trade(u, closed)).toEqual({ error: { code: "MARKET_CLOSED" } });

    const expired = await newMarket({ closesAt: new Date(Date.now() - 60_000) });
    expect(await trade(u, expired)).toEqual({ error: { code: "MARKET_CLOSED" } });

    expect(await trade(u, marketId(9999))).toEqual({ error: { code: "NOT_FOUND" } });
    expect(await trade(userId("nobody"), await newMarket())).toEqual({
      error: expect.objectContaining({ code: "NOT_FOUND" }),
    });
  });
});

describe("resolveMarket", () => {
  it("pays 1 credit per winning share and settles the house", async () => {
    const a = await newUser("user_a");
    const b = await newUser("user_b");
    const m = await newMarket();
    const buyA = data(await trade(a, m, { outcomeIdx: 0, mode: "buy_shares", amount: 6 }));
    const buyB = data(await trade(b, m, { outcomeIdx: 1, mode: "buy_shares", amount: 4 }));
    const result = data(
      await resolveMarket(db, { marketId: m, winningIdx: 0, note: "Rush won", adminId: admin }),
    );
    expect(result.paidOut).toBe(6);
    expect(result.houseDelta).toBeCloseTo(buyA.cost + buyB.cost - 6, 6);
    expect(await getBalance(db, a)).toBeCloseTo(100 - buyA.cost + 6, 6);
    expect(await getBalance(db, b)).toBeCloseTo(100 - buyB.cost, 6);
    const [row] = await db.select().from(markets).where(eq(markets.id, m));
    expect(row).toMatchObject({
      status: "resolved",
      resolvedOutcome: 0,
      resolutionNote: "Rush won",
    });
  });

  it("resolves only once, and only to an outcome that exists", async () => {
    const m = await newMarket();
    expect(
      await resolveMarket(db, { marketId: m, winningIdx: 7, note: "", adminId: admin }),
    ).toEqual({
      error: expect.objectContaining({ code: "INVALID_MARKET" }),
    });
    data(await resolveMarket(db, { marketId: m, winningIdx: 1, note: "", adminId: admin }));
    expect(
      await resolveMarket(db, { marketId: m, winningIdx: 0, note: "", adminId: admin }),
    ).toEqual({
      error: { code: "ALREADY_SETTLED" },
    });
    expect(await voidMarket(db, { marketId: m, note: "", adminId: admin })).toEqual({
      error: { code: "ALREADY_SETTLED" },
    });
  });
});

describe("voidMarket", () => {
  it("refunds each user's net spend and zeroes positions", async () => {
    const a = await newUser("user_a");
    const b = await newUser("user_b");
    const m = await newMarket();
    data(await trade(a, m, { amount: 7 }));
    data(await trade(b, m, { outcomeIdx: 1, amount: 3 }));
    data(await voidMarket(db, { marketId: m, note: "Match cancelled", adminId: admin }));
    expect(await getBalance(db, a)).toBeCloseTo(100, 5);
    expect(await getBalance(db, b)).toBeCloseTo(100, 5);
    const open = await db.select().from(positions).where(eq(positions.marketId, m));
    expect(open.every((p) => Number(p.shares) === 0)).toBe(true);
  });

  it("never takes credits back from a user who already sold at a profit", async () => {
    const a = await newUser("user_a");
    const b = await newUser("user_b");
    const m = await newMarket();
    data(await trade(a, m, { mode: "buy_shares", amount: 5 }));
    data(await trade(b, m, { mode: "buy_shares", amount: 10 })); // pushes outcome 0 up
    data(await trade(a, m, { mode: "sell_shares", amount: 5 })); // a sells at the higher price
    const before = await getBalance(db, a);
    data(await voidMarket(db, { marketId: m, note: "", adminId: admin }));
    expect(await getBalance(db, a)).toBe(before);
  });
});

describe("a long run of trades", () => {
  it("keeps every invariant, and total cost equals C(q_final) - C(q0)", async () => {
    const users = await Promise.all(["u1", "u2", "u3", "u4"].map((id) => newUser(id)));
    const m = await newMarket({
      outcomes: [{ label: "A" }, { label: "B" }, { label: "C" }],
      b: 15,
    });
    let seed = 7;
    const rand = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let total = 0;
    for (let n = 0; n < 60; n += 1) {
      const u = users[n % users.length] as UserId;
      const outcomeIdx = Math.floor(rand() * 3);
      const sell = rand() < 0.3;
      const result = await trade(u, m, {
        outcomeIdx,
        mode: sell ? "sell_shares" : "buy_spend",
        amount: sell ? 1 + rand() * 3 : 1 + rand() * 6,
      });
      if ("data" in result) total += result.data.cost;
    }
    const outcomes = await db.select().from(marketOutcomes).where(eq(marketOutcomes.marketId, m));
    const q = outcomes.sort((x, y) => x.idx - y.idx).map((o) => Number(o.q));
    const q0 = outcomes.map((o) => Number(o.q0));
    expect(total).toBeGreaterThanOrEqual(lmsr.cost(15, q) - lmsr.cost(15, q0) - 1e-4);
    expect(total - (lmsr.cost(15, q) - lmsr.cost(15, q0))).toBeLessThan(1e-3);
  });
});
