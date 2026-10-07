# Product Spec: Play-Money Prediction Markets

**Author**: Derek *(drafted with Claude — review before approving)*
**Status**: draft
**Last updated**: 2026-10-06

---

## Problem

ASL fans already argue about who will win: in Discord, on Reddit, in stream chat. Those
predictions vanish and nobody keeps score. A Kalshi-style market turns opinions into prices,
shows the crowd's view of each match in real time, and keeps a leaderboard of who actually
calls it right, with no money at stake.

## Goal

A signed-in fan can trade on ASL outcomes with free play-money credits, see live crowd
probabilities, and climb a leaderboard of the sharpest predictors.

## Non-Goals

- **Real money in any form.** No deposits, purchases, cash-out, gifting, or prizes of value.
  This is a locked decision, not a phase-one limitation.
- Order books, limit orders, or user-to-user trading. The house market maker (LMSR) quotes
  every trade.
- Short selling. Users can sell only shares they hold.
- Automated resolution from live data feeds. An admin resolves from official results.
- Markets on non-ASL events.

## Success Criteria

- [ ] New users get 100 minerals on first sign-in and can trade within a minute.
- [ ] A trade shows its exact cost and the price impact before confirming.
- [ ] Prices update for other viewers within ~10 seconds of a trade.
- [ ] Every resolved market pays out exactly 1 credit per winning share; ledger invariants hold.
- [ ] Leaderboard ranks by net worth (balance + positions at current prices).
- [ ] An admin can create a match market in under 2 minutes, with an ELO-based opening price.

## Market Types (v1)

| Type | Example | Outcomes |
|---|---|---|
| Match winner | "Flash vs Soulkey — S22 Ro8" | 2 |
| Season champion | "Who wins ASL S22?" | All remaining players |
| Yes/No prop | "Does a Protoss reach the S22 final?" | 2 |

## User Stories

- As a fan, I want to buy "Flash" at 38% because I think he's underrated, and get paid if he wins.
- As a fan, I want to sell my position before the match if the price moves my way.
- As a fan, I want to see my portfolio and how my calls have done over a season.
- As an admin (Derek), I want to open markets when brackets are drawn and resolve them after
  broadcasts.
- As an admin, I want to void a market if a match is cancelled, refunding everyone.

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Market maker | LMSR | Always-on liquidity with few users; bounded house loss |
| Currency | Minerals ("credits" in code), play money only | Legal simplicity; it's for fun. StarCraft flavor |
| Starting balance | 100 minerals | Set by Derek 2026-10-07. Liquidity (`b`) is sized so ~10 trades are meaningful |
| Opening prices | ELO-derived or manual, floored at 5% | Sensible start; caps subsidy |
| Resolution | Manual by admin, with a note | Simple and auditable |

## Open Questions

- [ ] Weekly mineral top-up for broke users, or a one-time "bankruptcy reset"? More pressing with a
  100-mineral start — owner: Derek
- [ ] Leaderboard per season, all-time, or both? — owner: Derek
- [ ] Do markets close at broadcast start or at match start? — owner: Derek
- [ ] Minimum account age to appear on the leaderboard (anti-alt)? — owner: Derek

## Related

- ROADMAP: Feature → Markets, Portfolio, Leaderboard, Admin
- Foundation: Docs/foundation-specs/market-engine.md, Docs/foundation-specs/ledger.md
- Feature spec: Docs/feature-specs/markets.md *(to be written when this spec is approved)*
