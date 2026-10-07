/**
 * LMSR (Logarithmic Market Scoring Rule) automated market maker.
 *
 * Pure functions, no I/O. This file is the single source of truth for pricing:
 * do not reimplement these formulas in SQL or in client code.
 *
 *   C(q)   = b * ln( sum_j exp(q_j / b) )          cost function
 *   p_i(q) = exp(q_i / b) / sum_j exp(q_j / b)     price of outcome i, sum_i p_i = 1
 *
 * A trader who moves the quantity vector from q to q' pays C(q') - C(q).
 * Each share of the winning outcome pays exactly 1 credit at resolution.
 *
 * Worst-case market-maker loss (the "subsidy" the house puts in) is
 *   b * ln(1 / p_min)   where p_min is the smallest initial price,
 * which is b * ln(n) for a uniform start over n outcomes.
 *
 * Money rounding: floats are used only inside this module. Callers should settle
 * with roundCostUp (buys) and roundProceedsDown (sells) so rounding never favors
 * the trader, then store values as numeric(18,6).
 */

export type Quantities = readonly number[];

export interface Quote {
  outcome: number;
  /** Signed shares: positive = buy, negative = sell. */
  shares: number;
  /** Signed credits: positive = trader pays, negative = trader receives. */
  cost: number;
  /** |cost / shares|, the average fill price per share. */
  avgPrice: number;
  priceBefore: number;
  priceAfter: number;
}

const MICRO = 1e6;
/** Beyond this |shares / b| the closed-form log1p path can overflow; use the direct difference. */
const DIRECT_PATH_THRESHOLD = 30;
const MAX_EXP_ARG = 700;

function assertMarket(b: number, q: Quantities): void {
  if (!Number.isFinite(b) || b <= 0) {
    throw new RangeError(`b must be a positive finite number, got ${b}`);
  }
  if (q.length < 2) throw new RangeError("a market needs at least 2 outcomes");
  for (const x of q) {
    if (!Number.isFinite(x)) throw new RangeError("quantities must be finite numbers");
  }
}

function assertOutcome(q: Quantities, i: number): void {
  if (!Number.isInteger(i) || i < 0 || i >= q.length) {
    throw new RangeError(`outcome index ${i} out of range for ${q.length} outcomes`);
  }
}

function assertFinite(x: number, name: string): void {
  if (!Number.isFinite(x)) throw new RangeError(`${name} must be a finite number, got ${x}`);
}

/** Numerically stable ln(sum(exp(x))). */
function logSumExp(xs: readonly number[]): number {
  let m = -Infinity;
  for (const x of xs) if (x > m) m = x;
  let s = 0;
  for (const x of xs) s += Math.exp(x - m);
  return m + Math.log(s);
}

/** LMSR cost function C(q). */
export function cost(b: number, q: Quantities): number {
  assertMarket(b, q);
  return b * logSumExp(q.map((x) => x / b));
}

/** All outcome prices (softmax of q / b). Always sums to 1. */
export function prices(b: number, q: Quantities): number[] {
  assertMarket(b, q);
  const z = q.map((x) => x / b);
  let m = -Infinity;
  for (const x of z) if (x > m) m = x;
  const e = z.map((x) => Math.exp(x - m));
  const s = e.reduce((a, c) => a + c, 0);
  return e.map((x) => x / s);
}

/** Price of a single outcome. */
export function price(b: number, q: Quantities, i: number): number {
  assertOutcome(q, i);
  const p = prices(b, q)[i];
  if (p === undefined) throw new RangeError(`outcome index ${i} out of range`);
  return p;
}

/** New quantity vector after trading `shares` (signed) of outcome i. Does not mutate q. */
export function applyTrade(q: Quantities, i: number, shares: number): number[] {
  assertOutcome(q, i);
  assertFinite(shares, "shares");
  return q.map((x, j) => (j === i ? x + shares : x));
}

/**
 * Signed cost of trading `shares` of outcome i: positive to buy, negative (proceeds) to sell.
 * Uses the identity C(q + d*e_i) - C(q) = b * ln(1 + p_i * (exp(d / b) - 1)),
 * which avoids the cancellation error of subtracting two large costs.
 */
export function tradeCost(b: number, q: Quantities, i: number, shares: number): number {
  assertMarket(b, q);
  assertOutcome(q, i);
  assertFinite(shares, "shares");
  if (shares === 0) return 0;

  const x = shares / b;
  if (Math.abs(x) <= DIRECT_PATH_THRESHOLD) {
    const arg = price(b, q, i) * Math.expm1(x);
    if (arg > -1) return b * Math.log1p(arg);
  }
  return cost(b, applyTrade(q, i, shares)) - cost(b, q);
}

/**
 * Shares of outcome i that `spend` credits buys right now (inverse of tradeCost for buys).
 * Closed form: shares = b * ln(1 + (exp(spend / b) - 1) / p_i).
 */
export function sharesForSpend(b: number, q: Quantities, i: number, spend: number): number {
  assertMarket(b, q);
  assertOutcome(q, i);
  assertFinite(spend, "spend");
  if (spend <= 0) throw new RangeError(`spend must be positive, got ${spend}`);
  const y = spend / b;
  if (y > MAX_EXP_ARG) throw new RangeError("spend is too large relative to b");
  const shares = b * Math.log1p(Math.expm1(y) / price(b, q, i));
  if (!Number.isFinite(shares)) throw new RangeError("spend is too large relative to b");
  return shares;
}

/** Quote a trade of a fixed number of shares (signed). */
export function quoteShares(b: number, q: Quantities, i: number, shares: number): Quote {
  const priceBefore = price(b, q, i);
  const c = tradeCost(b, q, i, shares);
  const priceAfter = price(b, applyTrade(q, i, shares), i);
  return {
    outcome: i,
    shares,
    cost: c,
    avgPrice: shares === 0 ? priceBefore : Math.abs(c / shares),
    priceBefore,
    priceAfter,
  };
}

/** Quote a buy that spends exactly `spend` credits. */
export function quoteSpend(b: number, q: Quantities, i: number, spend: number): Quote {
  const shares = sharesForSpend(b, q, i, spend);
  const quote = quoteShares(b, q, i, shares);
  return { ...quote, cost: spend };
}

/**
 * Initial quantity vector that makes the market open at `prior` prices:
 * q_i = b * ln(p_i), so C(q0) = 0. The prior is normalized; every entry must be > 0.
 */
export function initialQuantities(b: number, prior: readonly number[]): number[] {
  if (!Number.isFinite(b) || b <= 0) throw new RangeError(`b must be a positive finite number, got ${b}`);
  if (prior.length < 2) throw new RangeError("a market needs at least 2 outcomes");
  let total = 0;
  for (const p of prior) {
    if (!Number.isFinite(p) || p <= 0) throw new RangeError("prior probabilities must be finite and > 0");
    total += p;
  }
  return prior.map((p) => b * Math.log(p / total));
}

/**
 * Floor a prior at `minProb` by mixing with the uniform distribution. Keeps extreme ELO-derived
 * priors from producing huge subsidies. Every entry of the result is >= min(minProb, 1/n).
 */
export function clampPrior(prior: readonly number[], minProb = 0.02): number[] {
  const n = prior.length;
  let total = 0;
  for (const p of prior) {
    if (!Number.isFinite(p) || p < 0) throw new RangeError("prior probabilities must be finite and >= 0");
    total += p;
  }
  if (total <= 0) throw new RangeError("prior must have positive total mass");
  const lambda = Math.min(1, n * minProb);
  return prior.map((p) => (1 - lambda) * (p / total) + lambda / n);
}

/** Worst-case market-maker loss in credits for a market opened at `prior`: b * ln(1 / p_min). */
export function maxLoss(b: number, prior: readonly number[]): number {
  if (!Number.isFinite(b) || b <= 0) throw new RangeError(`b must be a positive finite number, got ${b}`);
  let total = 0;
  let min = Infinity;
  for (const p of prior) {
    if (!Number.isFinite(p) || p <= 0) throw new RangeError("prior probabilities must be finite and > 0");
    total += p;
    if (p < min) min = p;
  }
  return b * Math.log(total / min);
}

/** Worst-case loss for a uniform start over n outcomes: b * ln(n). */
export function maxLossUniform(b: number, n: number): number {
  if (!Number.isFinite(b) || b <= 0) throw new RangeError(`b must be a positive finite number, got ${b}`);
  if (!Number.isInteger(n) || n < 2) throw new RangeError("n must be an integer >= 2");
  return b * Math.log(n);
}

/** Round a buy cost UP to 1e-6 credits so rounding never favors the trader. */
export function roundCostUp(x: number): number {
  assertFinite(x, "amount");
  return Math.ceil(x * MICRO - 1e-6) / MICRO;
}

/** Round sale proceeds (or a payout owed to a trader) DOWN to 1e-6 credits. */
export function roundProceedsDown(x: number): number {
  assertFinite(x, "amount");
  return Math.floor(x * MICRO + 1e-6) / MICRO;
}
