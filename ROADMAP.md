# AslMarkets.Web — ROADMAP

Status lifecycle: `draft` → `approved` → `in-progress` → `implemented`

Agents: never self-promote a `draft` to `approved`. Humans approve.
Add items here via the operations defined in [CLAUDE.md](CLAUDE.md).

---

## Foundation

> Core infrastructure that everything else depends on.

| Status | Item | Notes |
|---|---|---|
| approved | Project scaffold | Next.js 15 + pnpm into the existing repo; keep `src/lib/market/` and `scripts/export-stats/` as-is <!-- updated: 2026-10-07 --> |
| draft | CI pipeline | GitHub Actions: typecheck → lint → test → stats:test → stats freshness → build |
| draft | Tailwind v4 setup + design tokens | Race colors from CLAUDE.md Domain Rules as tokens; type scale; dark mode |
| draft | Shared types + error model | `Result<T,E>`, `ActionResult`, branded IDs (`MarketId`, `UserId`), error codes incl. ledger errors |
| draft | Stats data loader | `src/lib/stats/`: Zod schemas for every `data/generated/*.json`, typed loaders for RSC. Spec: `Docs/foundation-specs/stats-data.md` |
| draft | Database: Neon + Drizzle schema & migrations | Tables from `Docs/foundation-specs/ledger.md`; `drizzle-kit` migrations; seed script |
| draft | Ledger service | `lib/services/ledger`: `executeTrade`, `resolveMarket`, `voidMarket`, `grantCredits` — each one transaction; concurrency test |
| draft | Auth — Clerk + Discord/Google | Product spec: `Docs/product-specs/auth.md`. Lazy user + account provisioning on first authed action |

### Archive

- [implemented 2026-10-06] LMSR pricing engine — `src/lib/market/lmsr.ts`, 22 tests incl. max-loss bound under random trading
- [implemented 2026-10-06] Stats export pipeline — `scripts/export-stats/`, layout contract + cross-tab validation, 20 tests

---

## Data

> The source workbook and the derived-stats pipeline.

| Status | Item | Notes |
|---|---|---|
| in-progress | Resolve exporter validation warnings | 14 warnings on first export (identity case variants, Jaedong race in tracker, Best prize = 4, Snow vs SnOw in Season Overview, S21 tracker vs placements). Derek decides each; fixes go in the xlsx. Triage + resolution: `Docs/reports/2026-10-07-stats-validation.md`. 13 of 14 cleared on branch `stats-curator-triage`; open: Best's prize total, S5 has 27 players <!-- updated: 2026-10-07 --> |
| in-progress | S21 final results | Entered from Liquipedia on branch `stats-curator-triage` (soma def. Flash 4–3). Season Overview, Placements, and tracker are final; ELO / Player Stats / Race Stats still cover S1–S20 <!-- updated: 2026-10-07 --> |
| draft | Player identity map | `data/player-aliases.json`: confirmed alias → canonical player. Exporter applies it and reports unmapped variants. Confirmed aliases so far are listed in CLAUDE.md Domain Rules and already merged in the workbook <!-- updated: 2026-10-07 --> |
| draft | Exporter: write LF line endings | On Windows the exporter writes CRLF; git normalizes it, but a byte-level CI freshness check would fail. Open outputs with `newline="\n"` |
| draft | Compute derived stats in the pipeline | Recompute ELO, career stats, and race stats from placements in code so corrections propagate; diff against workbook values before switching over. Notes 2026-10-07: Race Stats aggregates don't reproduce from placements and are stale after the race corrections; ELO was recomputed once by `scripts/workbook-fixes/apply_2026_10_07_decisions.py` (`compute_elo`), which is the starting point; all three tabs need extending to S21 (clears the soma `CHAMPIONSHIP_MISMATCH`) <!-- updated: 2026-10-07 --> |

---

## Feature

> User-facing capabilities. Each item must have an approved feature-spec before work begins.

| Status | Item | Notes |
|---|---|---|
| draft | Stats: seasons index + season detail | Product spec: `Docs/product-specs/stats-site.md` |
| draft | Stats: players index + player detail | Placement timeline, ELO, career stats |
| draft | Stats: race stats + ELO leaderboard | All Race Stats tables; matchup matrix |
| draft | Markets: list + market detail with trade panel | Product spec: `Docs/product-specs/markets.md` |
| draft | Portfolio | Positions, open P/L at current prices, trade history, ledger |
| draft | Leaderboard | Net worth = balance + positions marked to market |
| draft | Admin: create / close / resolve / void markets | Clerk role-gated; ELO-derived priors optional |

---

## Integration

> Third-party systems, APIs, and SDKs. Each item needs an integration-spec.

| Status | Item | Notes |
|---|---|---|
| draft | Clerk integration | Spec: `Docs/integration-specs/clerk.md` |
| draft | Neon + Drizzle integration | Spec: `Docs/integration-specs/neon-drizzle.md` |

---

## Design

> UI polish, component library, and accessibility.

| Status | Item | Notes |
|---|---|---|
| draft | Component library baseline | Button, Input, Modal, Toast, DataTable, RaceBadge, PlacementBadge, PriceChip — see `Docs/components/` |
| draft | Price history chart | Per-outcome price over time on market detail |
| draft | Dark mode support | Tailwind `dark:` variant + system preference; race tokens need dark variants |
| draft | Skeleton components | One skeleton per async surface before Suspense fallback |
