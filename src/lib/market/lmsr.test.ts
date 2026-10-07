import { describe, expect, it } from "vitest";

import {
  applyTrade,
  clampPrior,
  cost,
  initialQuantities,
  maxLoss,
  maxLossUniform,
  price,
  prices,
  quoteShares,
  quoteSpend,
  roundCostUp,
  roundProceedsDown,
  sharesForSpend,
  tradeCost,
} from "./lmsr";

const sum = (xs: readonly number[]) => xs.reduce((a, c) => a + c, 0);

/** Indexed read that fails the test instead of yielding undefined (noUncheckedIndexedAccess). */
function at(xs: readonly number[], i: number): number {
  const x = xs[i];
  if (x === undefined) throw new Error(`index ${i} out of range`);
  return x;
}

/** Small seeded PRNG so the simulation tests are deterministic. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("prices", () => {
  it("are uniform at q = 0 and sum to 1", () => {
    expect(prices(100, [0, 0])).toEqual([0.5, 0.5]);
    const p = prices(100, [0, 0, 0, 0]);
    expect(sum(p)).toBeCloseTo(1, 12);
    for (const x of p) expect(x).toBeCloseTo(0.25, 12);
  });

  it("follow the logistic curve for binary markets", () => {
    const b = 100;
    expect(price(b, [b * Math.log(3), 0], 0)).toBeCloseTo(0.75, 12);
    expect(price(b, [b * Math.log(3), 0], 1)).toBeCloseTo(0.25, 12);
  });

  it("stay finite and sum to 1 for very large quantities", () => {
    const p = prices(100, [1e5, 0, -1e5]);
    for (const x of p) expect(Number.isFinite(x)).toBe(true);
    expect(sum(p)).toBeCloseTo(1, 12);
    expect(p[0]).toBeCloseTo(1, 12);
  });
});

describe("cost", () => {
  it("equals b * ln(n) at the uniform start", () => {
    expect(cost(100, [0, 0])).toBeCloseTo(100 * Math.log(2), 10);
    expect(cost(50, [0, 0, 0])).toBeCloseTo(50 * Math.log(3), 10);
  });
});

describe("tradeCost", () => {
  it("matches the direct cost difference", () => {
    const b = 100;
    const q = [20, -5, 3];
    for (const shares of [0.5, 10, 75, -10, -30]) {
      const direct = cost(b, applyTrade(q, 1, shares)) - cost(b, q);
      expect(tradeCost(b, q, 1, shares)).toBeCloseTo(direct, 9);
    }
  });

  it("is approximately price * shares for tiny trades", () => {
    const b = 100;
    const q = [30, 0];
    const p = price(b, q, 0);
    expect(tradeCost(b, q, 0, 0.001)).toBeCloseTo(p * 0.001, 8);
  });

  it("is path independent: buying in two steps costs the same as one", () => {
    const b = 120;
    const q0 = [0, 0, 0];
    const oneShot = tradeCost(b, q0, 2, 25);
    const first = tradeCost(b, q0, 2, 10);
    const q1 = applyTrade(q0, 2, 10);
    const second = tradeCost(b, q1, 2, 15);
    expect(first + second).toBeCloseTo(oneShot, 9);
  });

  it("round trip (buy then sell the same shares) nets to zero", () => {
    const b = 100;
    const q0 = [0, 0];
    const paid = tradeCost(b, q0, 0, 40);
    const received = -tradeCost(b, applyTrade(q0, 0, 40), 0, -40);
    expect(received).toBeCloseTo(paid, 9);
  });

  it("buying costs more than price * shares (convex) and averages between before/after prices", () => {
    const b = 100;
    const quote = quoteShares(b, [0, 0], 0, 50);
    expect(quote.priceBefore).toBeCloseTo(0.5, 12);
    expect(quote.priceAfter).toBeCloseTo(1 / (1 + Math.exp(-0.5)), 12);
    expect(quote.avgPrice).toBeGreaterThan(quote.priceBefore);
    expect(quote.avgPrice).toBeLessThan(quote.priceAfter);
  });

  it("handles very large trades via the direct path", () => {
    const b = 10;
    const c = tradeCost(b, [0, 0], 0, 1000);
    expect(Number.isFinite(c)).toBe(true);
    expect(c).toBeGreaterThan(900);
    expect(c).toBeLessThan(1000);
  });
});

describe("sharesForSpend", () => {
  it("is the inverse of tradeCost for buys", () => {
    const b = 100;
    const q = [15, -10, 4];
    for (const spend of [0.01, 1, 25, 400]) {
      for (const i of [0, 1, 2]) {
        const shares = sharesForSpend(b, q, i, spend);
        expect(tradeCost(b, q, i, shares)).toBeCloseTo(spend, 7);
      }
    }
  });

  it("quoteSpend reports exactly the spend", () => {
    const quote = quoteSpend(100, [0, 0], 1, 30);
    expect(quote.cost).toBe(30);
    expect(quote.shares).toBeGreaterThan(30);
    expect(quote.priceAfter).toBeGreaterThan(quote.priceBefore);
  });

  it("rejects non-positive or absurd spends", () => {
    expect(() => sharesForSpend(100, [0, 0], 0, 0)).toThrow(RangeError);
    expect(() => sharesForSpend(100, [0, 0], 0, -5)).toThrow(RangeError);
    expect(() => sharesForSpend(1, [0, 0], 0, 1e6)).toThrow(RangeError);
  });
});

describe("multi-outcome markets", () => {
  it("buying one outcome raises its price and lowers every other", () => {
    const b = 80;
    const q = [0, 0, 0, 0, 0];
    const before = prices(b, q);
    const after = prices(b, applyTrade(q, 3, 40));
    expect(at(after, 3)).toBeGreaterThan(at(before, 3));
    for (const j of [0, 1, 2, 4]) expect(at(after, j)).toBeLessThan(at(before, j));
    expect(sum(after)).toBeCloseTo(1, 12);
  });
});

describe("priors", () => {
  it("initialQuantities reproduces the prior as opening prices and C(q0) = 0", () => {
    const b = 100;
    const prior = [0.7, 0.2, 0.1];
    const q0 = initialQuantities(b, prior);
    const p = prices(b, q0);
    prior.forEach((x, k) => expect(p[k]).toBeCloseTo(x, 12));
    expect(cost(b, q0)).toBeCloseTo(0, 10);
  });

  it("initialQuantities normalizes an unnormalized prior", () => {
    const q0 = initialQuantities(100, [7, 2, 1]);
    const p = prices(100, q0);
    expect(p[0]).toBeCloseTo(0.7, 12);
  });

  it("clampPrior enforces a floor and keeps a distribution", () => {
    const clamped = clampPrior([0.995, 0.004, 0.001], 0.02);
    expect(sum(clamped)).toBeCloseTo(1, 12);
    for (const p of clamped) expect(p).toBeGreaterThanOrEqual(0.02 - 1e-12);
  });

  it("rejects bad priors", () => {
    expect(() => initialQuantities(100, [0.5, 0])).toThrow(RangeError);
    expect(() => initialQuantities(100, [1])).toThrow(RangeError);
    expect(() => clampPrior([0, 0])).toThrow(RangeError);
  });
});

describe("maxLoss bound", () => {
  it("is b ln n for uniform and b ln(1/p_min) for a prior", () => {
    expect(maxLossUniform(100, 2)).toBeCloseTo(100 * Math.log(2), 12);
    expect(maxLoss(100, [0.5, 0.5])).toBeCloseTo(100 * Math.log(2), 12);
    expect(maxLoss(100, [0.8, 0.15, 0.05])).toBeCloseTo(100 * Math.log(20), 12);
  });

  it("holds under random trading for every possible winner", () => {
    const rand = mulberry32(42);
    const cases: Array<{ b: number; prior: number[] }> = [
      { b: 100, prior: [0.5, 0.5] },
      { b: 60, prior: [0.7, 0.2, 0.1] },
      { b: 150, prior: [0.25, 0.25, 0.25, 0.25] },
    ];
    for (const { b, prior } of cases) {
      const q0 = initialQuantities(b, prior);
      let q = [...q0];
      let revenue = 0;
      const held = prior.map(() => 0); // net user shares per outcome
      for (let t = 0; t < 400; t++) {
        const i = Math.floor(rand() * prior.length);
        const shares = (rand() - 0.4) * 80; // mostly buys, some sells (shorting allowed here)
        revenue += tradeCost(b, q, i, shares);
        q = applyTrade(q, i, shares);
        held[i] = at(held, i) + shares;
      }
      const bound = maxLoss(b, prior);
      for (let winner = 0; winner < prior.length; winner++) {
        const loss = at(held, winner) - revenue; // pays 1 per winning share
        expect(loss).toBeLessThanOrEqual(bound + 1e-6);
      }
    }
  });
});

describe("rounding", () => {
  it("rounds costs up and proceeds down at 1e-6 without float noise", () => {
    expect(roundCostUp(1.0000001)).toBe(1.000001);
    expect(roundCostUp(1)).toBe(1);
    expect(roundCostUp(0.1 + 0.2)).toBe(0.3);
    expect(roundProceedsDown(1.9999999)).toBe(1.999999);
    expect(roundProceedsDown(2)).toBe(2);
    expect(roundProceedsDown(0.1 + 0.2)).toBe(0.3);
  });
});

describe("validation", () => {
  it("rejects bad b, bad outcome index, and non-finite shares", () => {
    expect(() => prices(0, [0, 0])).toThrow(RangeError);
    expect(() => prices(-1, [0, 0])).toThrow(RangeError);
    expect(() => prices(100, [0])).toThrow(RangeError);
    expect(() => price(100, [0, 0], 2)).toThrow(RangeError);
    expect(() => tradeCost(100, [0, 0], 0, Number.NaN)).toThrow(RangeError);
    expect(() => tradeCost(100, [0, Number.POSITIVE_INFINITY], 0, 1)).toThrow(RangeError);
  });
});
