# Foundation Spec: Market Engine (LMSR)

**Status**: implemented (pricing math) · draft (priors, settlement helpers)
**Last updated**: 2026-10-06
**Module**: `src/lib/market/lmsr.ts` (pure, no I/O) · tests: `lmsr.test.ts`

## Why LMSR

An order book needs many active traders to have liquidity; this site will have tens.
LMSR is an automated market maker: the house always quotes a price, prices always sum to 1,
and the house's worst-case loss is known in advance and capped. A single parameter `b`
controls depth.

## Math

```
C(q)   = b · ln Σ exp(q_j / b)                  cost function
p_i(q) = exp(q_i / b) / Σ exp(q_j / b)          price = implied probability
trade cost  = C(q + Δ·e_i) − C(q)
           = b · ln(1 + p_i · (exp(Δ/b) − 1))   (closed form used in code)
shares for spend S = b · ln(1 + (exp(S/b) − 1) / p_i)
max house loss     = b · ln(1 / p_min(initial))
```

A winning share pays 1 credit, so a price of 0.62 means "62% likely" and costs about 0.62 per
share at the margin.

## Public API

| Function | Purpose |
|---|---|
| `prices(b, q)` / `price(b, q, i)` | Current prices (softmax, overflow-safe) |
| `cost(b, q)` | Cost function C(q) |
| `tradeCost(b, q, i, shares)` | Signed cost; + = trader pays, − = trader receives |
| `sharesForSpend(b, q, i, spend)` | Inverse: shares bought for a credit amount |
| `quoteShares` / `quoteSpend` | Full quote: cost, avg price, price before/after |
| `applyTrade(q, i, shares)` | New q vector (immutable) |
| `initialQuantities(b, prior)` | q₀ so the market opens at `prior` prices with C(q₀)=0 |
| `clampPrior(prior, minProb)` | Mix with uniform so no outcome is below `minProb` |
| `maxLoss(b, prior)` / `maxLossUniform(b, n)` | House subsidy bound |
| `roundCostUp` / `roundProceedsDown` | Settle to 1e-6 credits, never in the trader's favor |

## Rules

- Floats live only inside this module. Persist `numeric(18,6)` and convert at the service
  boundary.
- Never re-derive these formulas elsewhere (SQL, client, actions). Import them.
- Client components may import this module for **display-only** live quotes. The server
  recomputes inside the trade transaction.
- No shorting in v1: sells are limited to the user's position (enforced in the ledger).

## Priors from ELO (draft)

For a binary match market between A and B, `P(A) = 1 / (1 + 10^((R_B − R_A) / 400))`, then
`clampPrior([P, 1−P], 0.05)`. Caveats to show admins:
- Workbook ELO is **placement-based** (tiers, not match results), so it's a weak predictor.
- Identity splits in the workbook (see Data roadmap) distort some ratings.
- Admin can always override with a manual prior or uniform.

Season-winner markets: uniform over remaining players, or softmax of ELO / 400·ln10 with the
same floor.

## Tests that exist (22)

Prices sum to 1 and stay finite at extreme q; closed-form trade cost matches direct difference;
path independence; buy-then-sell round trip nets zero; `sharesForSpend` inverts `tradeCost`;
priors reproduce opening prices; house loss ≤ bound under 400 random trades for every possible
winner; rounding direction; input validation.
