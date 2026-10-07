# Experience Graph — AslMarkets.Web

> **Product lens**: every surface a user can reach and how those surfaces connect.
> This is the authoritative map for product decisions. Engineering uses it to
> understand scope before touching feature specs.

## How to Read This Graph

Each node is a **screen or surface** the user can see. Edges are **user actions**
that move between surfaces.

Status markers:
- `[LIVE]` = fully implemented and deployed
- `[WIP]` = in progress
- `[SPEC]` = spec exists, work not started
- `[IDEA]` = not yet specced

---

## Surface Map

```
[Home]  [SPEC]
  ├─ Featured open markets  →  [Market Detail]
  ├─ Current season card    →  [Season Detail]
  └─ Nav: Stats · Markets · Leaderboard · Portfolio (signed in) · Sign in

── Stats (public, no account needed) ─────────────────────────────

[Seasons Index]  [SPEC]
  └─ Select season  →  [Season Detail]

[Season Detail]  [SPEC]
  ├─ Finals result, prize pool (KRW, ≈USD), race distribution
  ├─ Full placement table  →  [Player Detail]
  └─ Markets for this season  →  [Market Detail]

[Players Index]  [SPEC]
  ├─ Search / filter by race, sort by ELO, titles, seasons
  └─ Select player  →  [Player Detail]

[Player Detail]  [SPEC]
  ├─ Placement timeline S1–S21, career stats, ELO (current + peak)
  └─ Open markets involving this player  →  [Market Detail]

[Race Stats]  [SPEC]
  └─ Title share, finals by matchup, playoff and all-stage matrices, participation by season

[ELO Leaderboard]  [SPEC]
  └─ Select player  →  [Player Detail]

── Markets ───────────────────────────────────────────────────────

[Markets Index]  [SPEC]
  ├─ Tabs: Open · Closed · Resolved
  └─ Select market  →  [Market Detail]

[Market Detail]  [SPEC]
  ├─ Outcomes with live prices, price history, rules, close time
  ├─ Player links  →  [Player Detail]
  ├─ Signed out: "Sign in to trade"  →  [Sign In]
  └─ Signed in: Trade panel (buy/sell)  →  receipt in place; position updates

[Portfolio]  [SPEC]  (signed in)
  ├─ Balance, open positions (marked to market), resolved P/L
  ├─ Trade history, credit history
  └─ Select position  →  [Market Detail]

[Leaderboard]  [SPEC]
  └─ Net worth ranking (balance + positions at current prices)

[Sign In]  [SPEC]
  └─ Discord / Google via Clerk  →  return to origin page (+1,000 credits first time)

── Admin (is_admin only) ─────────────────────────────────────────

[Admin: Markets]  [IDEA]
  ├─ Create market (question, outcomes, close time, b, prior: uniform | ELO | manual)
  ├─ Close early
  ├─ Resolve (pick outcome + note)  →  payouts
  └─ Void (note)  →  refunds
```

---

## Surfaces Without an Approved Spec

Engineering work may not begin until a spec exists and is approved.

- All surfaces above. Product specs exist as drafts: `stats-site.md`, `markets.md`, `auth.md`.
- Admin has no product spec yet.

---

## Updating This Graph

Add a new node when a new surface is introduced. Update the status marker when
a surface moves from IDEA → SPEC → WIP → LIVE. This file is the source of truth
for surface count and navigation topology.
