# StarCoins — ROADMAP

Status lifecycle: `draft` → `approved` → `in-progress` → `implemented`

Agents: never self-promote a `draft` to `approved`. Humans approve.
Add items here via the operations defined in [CLAUDE.md](CLAUDE.md).

---

## Foundation

> Core infrastructure that everything else depends on.

| Status | Item | Notes |
|---|---|---|
| approved | Playwright E2E setup | `pnpm test:e2e` is referenced by `Harness/code-validation.md` but not installed. Needs real pages to test first <!-- approved by Derek 2026-10-07 --> |
| approved | Pre-commit hooks | Locked decision says lint/format run pre-commit. Typecheck + lint + format:check on staged files <!-- approved by Derek 2026-10-07 --> |
| approved | CI pipeline | GitHub Actions: typecheck → lint → test → stats:test → stats freshness → build <!-- approved by Derek 2026-10-07 --> |

### Archive

- [implemented 2026-10-07] Shared types + error model — `src/lib/types/` (Result, ActionResult with user copy, branded ids). Works once the Neon and Clerk keys are set
- [implemented 2026-10-07] Database: Neon + Drizzle schema & migrations — `src/lib/db/`, `drizzle/0000_init.sql`. Works once the Neon and Clerk keys are set
- [implemented 2026-10-07] Ledger service — `src/lib/services/ledger/`, 24 PGlite tests + real-Postgres concurrency test. Works once the Neon and Clerk keys are set
- [implemented 2026-10-07] Auth — Clerk + Discord/Google — Clerk 7, lazy provisioning with the 100-mineral grant, `/portfolio` and `/admin` protected. Works once the Neon and Clerk keys are set
- [implemented 2026-10-07] Tailwind v4 setup + design tokens — approved by Derek 2026-10-07. `src/app/globals.css`: race color tokens (guarded by a test), light/dark surface colors by system setting, type scale. Spec: `Docs/foundation-specs/design-tokens.md`
- [implemented 2026-10-07] Stats data loader — approved by Derek 2026-10-07. `src/lib/services/stats/` (the architecture's location, not `src/lib/stats/`): strict Zod schemas for all nine generated files, cached typed loaders, refuses an unknown schema version. The home page reads its figures through it
- [implemented 2026-10-07] Project scaffold — Next.js 15.5 App Router + React 19, TypeScript 5.9 strict, ESLint 9 flat config with layer-boundary rules, Prettier, Vitest + Testing Library (jsdom). Root layout, placeholder home page, `SiteFooter` with the fan-project, play-money, and Liquipedia notices
- [implemented 2026-10-06] LMSR pricing engine — `src/lib/market/lmsr.ts`, 22 tests incl. max-loss bound under random trading
- [implemented 2026-10-06] Stats export pipeline — `scripts/export-stats/`, layout contract + cross-tab validation, 20 tests

---

## Data

> The Liquipedia source data and the derived-stats pipeline.

| Status | Item | Notes |
|---|---|---|
| draft | Workbook-era player questions | `Byun`, `Jo Il-jang`, `Kim Myung-woon` were workbook rows in S10–S11 that match no Liquipedia player. Nothing is missing from the site's data; this is only a question of whether Derek knows who they were <!-- updated: 2026-10-07 --> |
| approved | In-progress season support | The pipeline assumes finished seasons. S22 needs partial placements, a live status, and a refresh routine <!-- approved by Derek 2026-10-07 --> |
| approved | Game-level stats | Series are parsed; individual maps (winner per map, map win rates by matchup) are in the wikitext but not exported <!-- approved by Derek 2026-10-07 --> |
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
| in-progress | First market: ASL S22 Grand Final | Built: `/admin` preset (Rush vs Soulkey, closes 2026-10-17 15:00 KST, ELO opening odds). Waiting on Derek: Neon + Clerk keys, `pnpm db:migrate`, `pnpm db:make-admin`, then create it from `/admin`. Public trading also needs a deployment <!-- updated: 2026-10-07 --> |

### Archive

- [implemented 2026-10-07] Markets: list + market detail with trade panel — `/markets`, `/markets/[slug]`, live polling, trade panel with preview. Works once the Neon and Clerk keys are set
- [implemented 2026-10-07] Portfolio — `/portfolio`. Works once the Neon and Clerk keys are set
- [implemented 2026-10-07] Leaderboard — `/leaderboard`, net worth marked to market. Works once the Neon and Clerk keys are set
- [implemented 2026-10-07] Admin: create / close / resolve / void markets — `/admin`, ELO-based opening odds, S22 final preset. Works once the Neon and Clerk keys are set
- [implemented 2026-10-07] Stats: seasons index + season detail — `/seasons`, `/seasons/[season]` (21 static pages). Feature spec: `Docs/feature-specs/stats-site.md`
- [implemented 2026-10-07] Stats: players index + player detail — `/players`, `/players/[slug]` (85 static pages). Feature spec: `Docs/feature-specs/stats-site.md`
- [implemented 2026-10-07] Stats: head-to-head lookup — `/head-to-head?a=&b=`, aliases accepted. Feature spec: `Docs/feature-specs/stats-site.md`
- [implemented 2026-10-07] Stats: race stats + ELO leaderboard — `/elo` (spreadsheet columns), `/races`. Feature spec: `Docs/feature-specs/stats-site.md`

---

## Integration

> Third-party systems, APIs, and SDKs. Each item needs an integration-spec.

| Status | Item | Notes |
|---|---|---|

### Archive

- [implemented 2026-10-07] Clerk integration — `Docs/integration-specs/clerk.md`. Works once the Neon and Clerk keys are set
- [implemented 2026-10-07] Neon + Drizzle integration — `Docs/integration-specs/neon-drizzle.md`. Works once the Neon and Clerk keys are set

---

## Design

> UI polish, component library, and accessibility.

| Status | Item | Notes |
|---|---|---|
| in-progress | Component library baseline | Built 2026-10-07: Button (primary, secondary), DataTable, RaceBadge, PlacementBadge, SiteHeader. Remaining, with markets: Input, Modal, Toast, PriceChip, more Button variants — see `Docs/components/` <!-- updated: 2026-10-07 --> |
| approved | Dark mode support | Surface colors and the `dark:` variant already follow the system setting (design tokens). Remaining: dark variants of the race colors, and a contrast check of every component in dark mode <!-- updated: 2026-10-07 --> <!-- approved by Derek 2026-10-07 --> |
| approved | Skeleton components | One skeleton per async surface before Suspense fallback <!-- approved by Derek 2026-10-07 --> |

### Archive

- [implemented 2026-10-07] Price history chart — Line chart per outcome on the market page. Works once the Neon and Clerk keys are set
