# Foundation Spec: Credit Ledger

**Status**: draft
**Last updated**: 2026-10-06
**Owner module**: `src/lib/services/ledger/`
**Depends on**: `Docs/foundation-specs/market-engine.md`, `Docs/integration-specs/neon-drizzle.md`

The ledger is the only system that creates, moves, or destroys credits. Bugs here are
the expensive kind (double-spends, phantom payouts), so it is specified tightly.

---

## Invariants (test every one)

1. **Conservation.** For every account, `accounts.balance = SUM(ledger_entries.amount)`
   for that account. The house account is included.
2. **No negative balances.** `CHECK (balance >= 0)` on user accounts. The house account
   may go negative (it funds market subsidies).
3. **No naked shorts.** A user can only sell shares they hold:
   `positions.shares >= 0` (`CHECK`). Selling is limited to the position size.
4. **Append-only history.** `ledger_entries` and `trades` are never updated or deleted.
   Corrections are new entries with `reason = 'adjustment'`.
5. **One resolution.** A market moves `open → closed → resolved | voided` once; every
   payout/refund is written in the same transaction as the status change.
6. **Server-side pricing.** Cost is recomputed from the locked `q` vector inside the
   transaction. A client-sent price or cost is only a slippage bound.
7. **Idempotency.** `trades.idempotency_key` is unique per user; a retried request
   returns the original trade instead of trading twice.

---

## Schema (reference SQL — implement in Drizzle `lib/db/schema.ts`)

Money columns are `numeric(18,6)`: credits with 6 decimal places. Shares too.

```sql
create type market_status as enum ('open', 'closed', 'resolved', 'voided');
create type market_kind   as enum ('binary', 'multi');
create type entry_reason  as enum ('signup_grant', 'periodic_grant', 'trade', 'payout',
                                   'refund', 'subsidy', 'adjustment');

create table users (
  id            text primary key,                -- Clerk user id
  display_name  text not null,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now()
);

create table accounts (
  id         bigserial primary key,
  user_id    text unique references users(id),  -- null for the single house account
  is_house   boolean not null default false,
  balance    numeric(18,6) not null default 0,
  constraint user_or_house check ((user_id is null) = is_house),
  constraint non_negative check (is_house or balance >= 0)
);
create unique index one_house on accounts (is_house) where is_house;

create table markets (
  id               bigserial primary key,
  slug             text unique not null,
  question         text not null,
  description      text not null default '',
  kind             market_kind not null,
  b                numeric(18,6) not null check (b > 0),
  status           market_status not null default 'open',
  closes_at        timestamptz not null,
  resolved_outcome int,                                   -- index into market_outcomes
  resolution_note  text,
  season           int,                                   -- ASL season, for linking to stats
  created_by       text not null references users(id),
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);

create table market_outcomes (
  market_id  bigint not null references markets(id),
  idx        int not null,
  label      text not null,
  player     text,                                        -- canonical player name if applicable
  q          numeric(18,6) not null,                      -- LMSR quantity
  primary key (market_id, idx)
);

create table trades (
  id               bigserial primary key,
  market_id        bigint not null references markets(id),
  user_id          text not null references users(id),
  outcome_idx      int not null,
  shares           numeric(18,6) not null check (shares <> 0),  -- + buy, - sell
  cost             numeric(18,6) not null,                     -- + paid, - received
  price_before     numeric(10,8) not null,
  price_after      numeric(10,8) not null,
  idempotency_key  text not null,
  created_at       timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table positions (
  user_id      text not null references users(id),
  market_id    bigint not null references markets(id),
  outcome_idx  int not null,
  shares       numeric(18,6) not null default 0 check (shares >= 0),
  cost_basis   numeric(18,6) not null default 0,   -- net credits spent, for refunds on void
  primary key (user_id, market_id, outcome_idx)
);

create table ledger_entries (
  id          bigserial primary key,
  account_id  bigint not null references accounts(id),
  amount      numeric(18,6) not null,               -- + credit, - debit
  reason      entry_reason not null,
  market_id   bigint references markets(id),
  trade_id    bigint references trades(id),
  note        text,
  created_at  timestamptz not null default now()
);
create index on ledger_entries (account_id, created_at);
```

---

## Operations

Each is a single `db.transaction(...)` on the `neon-serverless` Pool. Lock order is always
**market row → account rows (ascending id)** to avoid deadlocks.

### `executeTrade({ userId, marketId, outcomeIdx, mode, amount, maxCost?, minProceeds?, idempotencyKey })`

`mode` is `'buy_spend'` (spend N credits), `'buy_shares'`, or `'sell_shares'`.

1. If a trade with `(userId, idempotencyKey)` exists, return it (no-op).
2. `SELECT … FROM markets WHERE id = $1 FOR UPDATE`. Reject unless `status = 'open'` and
   `now() < closes_at` (DB clock, not app clock).
3. Load `market_outcomes` for the market (ordered by `idx`) → `q: number[]`.
4. `SELECT … FROM accounts WHERE user_id = $1 FOR UPDATE`.
5. Quote with `lmsr.ts`: `sharesForSpend` / `tradeCost`. Round with `roundCostUp` (buys)
   or `roundProceedsDown` (sells).
6. Reject: insufficient balance; sell larger than position; cost > `maxCost`; proceeds <
   `minProceeds`; resulting price outside `[0.001, 0.999]` (sanity guard).
7. Insert `trades`; update `market_outcomes.q[outcomeIdx]`; upsert `positions` (shares,
   cost_basis); insert `ledger_entries` (`-cost`, reason `trade`); update `accounts.balance`.
8. Return `{ trade, newBalance, prices }`.

### `resolveMarket({ marketId, winningIdx, note, adminId })`

1. Lock market; require `status in ('open','closed')`.
2. For every position on `winningIdx` with `shares > 0`: credit `roundProceedsDown(shares)`
   (1 credit per share), reason `payout`.
3. Debit the house account for the total paid out minus total trade revenue (the market
   maker's P/L), reason `subsidy`. That keeps conservation exact.
4. Set `status = 'resolved'`, `resolved_outcome`, `resolved_at`, `resolution_note`.

### `voidMarket({ marketId, note, adminId })`

Refund each user's net `cost_basis` across all outcomes (reason `refund`), zero positions,
house absorbs the difference, `status = 'voided'`. Used for cancelled matches and walkovers.

### `grantCredits({ userId, amount, reason })`

`signup_grant` (100 credits, shown as 100 minerals, on account creation) and `periodic_grant` (optional weekly
top-up). Grants come from the house account, so conservation holds.

---

## Concurrency test (required before shipping trades)

Start 50 concurrent `executeTrade` calls from 10 users on one market against a real Postgres
(Neon dev branch or local Docker). Then assert:
- every invariant above,
- the final `q` vector equals the initial `q` plus the sum of all trade shares per outcome,
- the sum of trade costs equals `C(q_final) − C(q_initial)` within 1e-4 (rounding).

PGlite is fine for functional tests, but it doesn't exercise row-lock contention.

---

## Defaults (tunable per market by admin)

| Setting | Default | Why |
|---|---|---|
| Signup grant | 100 credits ("100 minerals" in the UI) | Set by Derek 2026-10-07. Enough for ~10 meaningful trades |
| `b` binary market | 10 | Spending 5 credits moves a 50/50 market to ~70% (b=15: ~64%). Sized to a 100-credit balance |
| `b` multi market (season winner) | 15 | 16+ outcomes need more depth |
| House max loss | `b · ln(1/p_min)` | ~6.9 credits for a 50/50 binary at b=10 |
| Prior floor | 2% per outcome (`clampPrior`) | Caps subsidy for long shots |
