# AslMarkets.Web — ROADMAP

Status lifecycle: `draft` → `approved` → `in-progress` → `implemented`

Agents: never self-promote a `draft` to `approved`. Humans approve.
Add items here via the operations defined in [CLAUDE.md](CLAUDE.md).

---

## Foundation

> Core infrastructure that everything else depends on.

| Status | Item | Notes |
|---|---|---|
| draft | Playwright E2E setup | `pnpm test:e2e` is referenced by `Harness/code-validation.md` but not installed. Needs real pages to test first |
| draft | Pre-commit hooks | Locked decision says lint/format run pre-commit. Typecheck + lint + format:check on staged files |
| draft | CI pipeline | GitHub Actions: typecheck → lint → test → stats:test → stats freshness → build |
| draft | Tailwind v4 setup + design tokens | Race colors from CLAUDE.md Domain Rules as tokens; type scale; dark mode |
| draft | Shared types + error model | `Result<T,E>`, `ActionResult`, branded IDs (`MarketId`, `UserId`), error codes incl. ledger errors |
| draft | Stats data loader | `src/lib/stats/`: Zod schemas for every `data/generated/*.json`, typed loaders for RSC. Spec: `Docs/foundation-specs/stats-data.md` |
| draft | Database: Neon + Drizzle schema & migrations | Tables from `Docs/foundation-specs/ledger.md`; `drizzle-kit` migrations; seed script |
| draft | Ledger service | `lib/services/ledger`: `executeTrade`, `resolveMarket`, `voidMarket`, `grantCredits` — each one transaction; concurrency test |
| draft | Auth — Clerk + Discord/Google | Product spec: `Docs/product-specs/auth.md`. Lazy user + account provisioning on first authed action |

### Archive

- [implemented 2026-10-07] Project scaffold — Next.js 15.5 App Router + React 19, TypeScript 5.9 strict, ESLint 9 flat config with layer-boundary rules, Prettier, Vitest + Testing Library (jsdom). Root layout, placeholder home page, `SiteFooter` with the fan-project, play-money, and Liquipedia notices
- [implemented 2026-10-06] LMSR pricing engine — `src/lib/market/lmsr.ts`, 22 tests incl. max-loss bound under random trading
- [implemented 2026-10-06] Stats export pipeline — `scripts/export-stats/`, layout contract + cross-tab validation, 20 tests

---

## Data

> The Liquipedia source data and the derived-stats pipeline.

| Status | Item | Notes |
|---|---|---|
| draft | Workbook-era player questions | `Byun`, `Jo Il-jang`, `Kim Myung-woon` were workbook rows in S10–S11 that match no Liquipedia player. Nothing is missing from the site's data; this is only a question of whether Derek knows who they were <!-- updated: 2026-10-07 --> |
| draft | In-progress season support | The pipeline assumes finished seasons. S22 needs partial placements, a live status, and a refresh routine |
| draft | Game-level stats | Series are parsed; individual maps (winner per map, map win rates by matchup) are in the wikitext but not exported |
| draft | Remove the old workbook | `data/source/ASL_Complete_S1_S21.xlsx` and `scripts/workbook-fixes/` are reference only. Delete once Derek no longer wants them |

### Archive

- [implemented 2026-10-07] Liquipedia as the stats source — `scripts/liquipedia/` + `scripts/export-stats/`, schema version 2, 18 parser + 19 exporter tests. Approved by Derek after the audit (`Docs/reports/2026-10-07-liquipedia-audit.md`). Races for `815`, `ivOry`, `Queen` supplied by Derek in `data/source/overrides.json`
- [superseded 2026-10-07] Resolve exporter validation warnings — replaced by "Liquipedia as the stats source"
- [superseded 2026-10-07] S21 final results — replaced by "Liquipedia as the stats source"
- [superseded 2026-10-07] Player identity map — replaced by "Liquipedia as the stats source"
- [superseded 2026-10-07] Exporter: write LF line endings — replaced by "Liquipedia as the stats source"
- [superseded 2026-10-07] Compute derived stats in the pipeline — replaced by "Liquipedia as the stats source"

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
