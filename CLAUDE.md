# StarCoins

> Renamed from "ASL Markets" by Derek on 2026-10-07. The folder (`AslMarkets.Web`) and the
> GitHub repo (`DerekBla/ASL`) keep their old names for now; everything users see says StarCoins.


## Key thoughts
A fan-made site for the ASL (StarCraft: Brood War league, S1–S21+) with two halves:

1. **Stats** — publishes ASL history built from Liquipedia's season pages (`data/source/liquipedia/`):
   seasons, player placements, ELO, career stats, race matchup stats, every series played.
2. **Markets** — a for-fun, Kalshi-style prediction market on ASL outcomes (match winners,
   season champion, props), priced by an LMSR automated market maker, using **play-money
   credits only**.

Build the stats half first; it is useful on its own and gives markets something to link to.

## Locked-In Decisions

These choices are firm and non-negotiable. Do not propose alternatives without a
compelling, evidence-backed reason. Any change requires explicit human approval
and a ROADMAP entry before work begins.

| Concern | Decision |
|---|---|
| Money | **Play-money credits only.** No deposits, purchases, cash-out, transfers between users, or prizes of monetary value. Never build or scaffold anything that converts credits to or from real value. |
| Framework | Next.js 15 App Router + TypeScript — RSC-first, file-based routing |
| Language | TypeScript strict mode — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| Package manager | pnpm — workspace-aware, strict hoisting off |
| Styling | Tailwind CSS v4 — utility-first, no CSS-in-JS |
| Server state | TanStack Query v5 — all remote data lives here |
| Client state | Zustand v5 — UI-only ephemeral state; no server data in stores |
| Database | Neon Postgres + Drizzle ORM — `neon-serverless` (WebSocket) driver for anything that needs a transaction |
| Ledger | Every credit movement is one Postgres transaction through `lib/services/ledger` — see `Docs/foundation-specs/ledger.md` |
| Pricing | LMSR. `src/lib/market/lmsr.ts` is the only pricing implementation — never re-derive formulas in SQL, actions, or client code |
| Stats data | Static JSON in `data/generated/`, built by `scripts/export-stats/` from Liquipedia season pages stored in `data/source/liquipedia/` (changed from the xlsx on 2026-10-07, approved by Derek). The app reads only `data/generated/` at runtime |
| Auth | Clerk — Discord + Google OAuth only; no email/password |
| Testing | Vitest + Testing Library (unit/integration) + Playwright (E2E); Python `unittest` for the exporter |
| Lint / format | ESLint flat config + Prettier — enforced in CI and pre-commit |
| Deployment | Vercel (Node runtime default; Edge Runtime opt-in per route, never for ledger writes) |

---

## Domain Rules

Facts about the ASL data that are easy to get wrong. Follow them everywhere.

- **Races** are stored as letter codes `T` / `Z` / `P`. Display names: Terran / Zerg / Protoss.
- **Race colors** (from the spreadsheet; used site-wide as design tokens):

  | Race | Pale (player/data cells) | Dark (section headers only) |
  |---|---|---|
  | Terran | `#EAF3FB` | `#3A6EA8` |
  | Zerg | `#F0EAF9` | `#6B4FA0` |
  | Protoss | `#E6F4EC` | `#3D7A52` |

  Swapped or inconsistent race colors are a recurring bug. Use the tokens, never literals.
- **Placement labels** use an en-dash: `9th–12th`, `23rd–28th`. The exporter normalizes hyphens.
- **Minerals** are the play-money currency's name in everything users see (Derek, 2026-10-07):
  "100 minerals", never "credits" in UI copy. Code, schema, and the ledger spec keep the word
  *credits* for the same unit (1 mineral = 1 credit). Every new account gets **100 minerals**,
  once (`SIGNUP_GRANT_CREDITS = 100`). Market liquidity is sized to that balance: `b = 10` for a
  binary market (see `Docs/foundation-specs/ledger.md` Defaults).
- **Prize money** is stored in KRW (`₩`), from Liquipedia's per-placement payouts. No USD values
  are stored; if the UI shows USD it is an approximation and labeled as such.
- **Player identity**: canonical handles follow Liquipedia's current spelling. Confirmed by
  Derek on 2026-10-07 (alias → canonical): `Snow` → `SnOw` (Jang Yoon-chul), `hero` → `herO`
  (Zerg), `BeSt` → `Best`, `Effort`/`effOrt` → `EffOrt`, `Hyun` → `HyuN`,
  `huro`/`Yoon Soo-chul` → `tulbo` (Protoss), `JD` → `Jaedong` (Zerg). Any **new** case
  variant the exporter flags **must not be merged without Derek's confirmation**.
- **Races** come from Liquipedia, one per player. Confirmed by Derek: `sSak`, `Ample`, `Speed` are
  Terran; `Shine` is Zerg; `tulbo` is Protoss; `Jaedong` is Zerg. Liquipedia gives no race for
  `815` (Zerg), `Queen` (Zerg) and `ivOry` (Terran); Derek supplied those in
  `data/source/overrides.json`. A new player with no race is `null` until he adds one.
- **No dashes in prose** (Derek, 2026-10-07): site copy never uses a dash or hyphen in ordinary
  sentences or labels ("Head to head", "play money", "third place match"). Dashes stay in
  number notation: scores `4–3`, placements `9th–12th`, records `16–2`, date ranges, and `–`
  for an empty cell. Proper names keep theirs (`CC-BY-SA`). `src/app/__tests__/copy-dashes.test.tsx`
  enforces it on the main pages; URLs like `/head-to-head` are unaffected.
- **Attribution**: stats text and results derive from Liquipedia (CC-BY-SA 3.0). The site must
  credit Liquipedia and link the source pages (`seasons.json` carries each URL).
- **ELO** is placement-based (start 1500, K=32, pairwise by placement tier), not match-based.
  Label it that way in the UI. It is computed by `compute_elo` in the exporter.
- **Branding**: unofficial fan project. No ASL/SOOP/AfreecaTV logos or trade dress. Footer
  carries a "fan project, not affiliated" disclaimer.

---

## Architecture

Full module map, dependency rules, and data-flow patterns:
→ **[Harness/architecture.md](Harness/architecture.md)**

---

## Docs Map

| Folder | What lives there |
|---|---|
| `Harness/` | Agent guardrails: architecture, conventions, checklists, guidelines |
| `Harness/guidelines/` | Implementation patterns indexed by task type (`_index.json`) |
| `Harness/agents/` | Agent personas and prompt templates (`_index.json`) |
| `Docs/experience-graph.md` | Every user-reachable surface and how they connect |
| `Docs/feature-map/` | Engineering units: what can be built and what it depends on |
| `Docs/product-specs/` | What to build and why — human-authored, non-technical |
| `Docs/ui-specs/` | Component and feature design packages: states, copy, interactions |
| `Docs/foundation-specs/` | Core protocols: LMSR engine, credit ledger, stats data contract, design tokens |
| `Docs/integration-specs/` | Concrete third-party SDK and API implementations (Neon/Drizzle, Clerk) |
| `Docs/integration-specs/references/` | Lookup catalogs for external systems |
| `Docs/feature-specs/` | UI states, flows, view-model contracts, and routing |
| `Docs/components/` | Shared component catalog with usage rules (`_index.json`) |
| `Docs/tooling-specs/` | Agent tooling and automation specs (stats exporter) |
| `Docs/reports/` | Generated output — do not hand-author |
| `data/source/liquipedia/` | Fetched Liquipedia wikitext and the results parsed from it. Never hand-edit; re-run the scripts |
| `data/source/overrides.json` | Derek's corrections (display names, races). Agents propose, Derek confirms |
| `data/source/*.xlsx` | The old workbook, kept as a reference copy. Nothing reads it |
| `data/generated/` | Exporter output. Never hand-edit; re-run `pnpm stats:export` |

---

## Key Pitfalls

> This section accumulates hard-won lessons. Add an entry any time a non-obvious
> mistake costs real time. Format:
> **[YYYY-MM-DD] Short title** — what went wrong, and how to avoid it.

**[2026-10-06] Placeholder text parsed as a player** — the exporter read `TBD` in the S21
winner cell as a player name and marked the season complete. Name columns use `to_name`, which
maps `TBD` / `?` / `-` to `null`. Any new name column must use it too.

**[2026-10-06] Race Stats is eight tables in one sheet** — it can't be read with generic
"header row + rows until blank" logic. Every table is declared with exact cell coordinates in
`LAYOUT` in `export_stats.py`, and the export fails if a header moves.

**[2026-10-06] Case-insensitive sort was hash-order dependent** — `players.json` sorted by
`name.lower()` alone, so `BeSt`/`Best` swapped between runs (Python randomizes set order per
process). Always give sorts a total order (`(name.lower(), name)`). Determinism tests must run
the exporter in separate processes with different `PYTHONHASHSEED`s. Same-process runs hide this.

**[2026-10-07] Saving the workbook from Python is lossy** — an openpyxl load/save drops the
threaded-comments part and several drawing parts and rewrites the Race Stats chart. Scripted
workbook edits need Derek's say-so, go in `scripts/workbook-fixes/` as a dated one-off, and the
result must be opened in Excel to check. Prefer Derek editing in Excel for small changes.

**[2026-10-07] Race Stats aggregates don't derive from Player Placements** — participant
counts, finals head-to-head, and matchup totals on that tab could not be reproduced from the
rest of the workbook (even before corrections). Don't "fix" single numbers there; recompute
the tab in the pipeline. Player Stats counts and Placements Played/Best do reproduce exactly.

**[2026-10-07] The workbook was wrong in bulk, not in details** — it looked authoritative, and
two rounds of cell-level fixes went in before an audit against Liquipedia showed it matched on
only 486 of 576 entries (S10: 4 of 28). Check a dataset against its primary source before
polishing it. The three workbook pitfalls above are history; the workbook is no longer read.

**[2026-10-07] Liquipedia's summary tables disagree with its own match results** — S5's prize
table swaps Sharp and Sea, and S1's group tables list tied players in the wrong order. Derive
placements from series results; use the tables only as a cross-check.

**[2026-10-07] Liquipedia spells one player several ways** — `BeSt`/`Best`, `Snow`/`SnOw`,
`hero`/`herO`, even two spellings in one group. Newer pages also omit races. Identity and race
come from the player page each name resolves to, not from the name as written.

**[2026-10-07] Postgres checks CHECK constraints on an upsert's insert row** — a sell sent as
`INSERT … ON CONFLICT DO UPDATE` with negative shares failed `no_naked_shorts` even though the
update would have been fine. Sells update the existing position; only buys upsert.

**[2026-10-07] Drizzle leaves column names unqualified inside `sql` subqueries** — a correlated
subquery matched `trades.id` instead of `markets.id` and returned wrong volumes. Write
correlated subqueries with explicit aliases (`from trades t where t.market_id = "markets"."id"`).

**[2026-10-07] Clerk 7 (Core 3) removed `SignedIn`/`SignedOut`** — they still import, but throw
when rendered. Use `<Show when="signed-in">`. Check the installed package's types before
writing Clerk code from memory.

**[2026-10-07] Tooling versions are pinned by Next.js 15, not by "latest"** — the repo had
TypeScript 7 and would have taken ESLint 10, but `typescript-eslint` supports TypeScript below
6.1 and `eslint-config-next@15` supports ESLint up to 9. TypeScript is pinned to 5.9 and ESLint
to 9. Don't bump either without checking those two peer ranges, or until Next.js itself moves.

---

## ROADMAP Status Lifecycle

```
draft → approved → in-progress → implemented
```

- **draft**: idea captured, not yet evaluated
- **approved**: a human has signed off; an agent may begin work
- **in-progress**: actively being built — one item per agent at a time
- **implemented**: merged, tested, and deployed (or feature-flagged on)

### ROADMAP Operations (for agents)

- **Add X to roadmap**: create a `draft` entry in the correct category in
  [ROADMAP.md](ROADMAP.md). Never self-promote a draft to `approved`.
- **Update roadmap**: change status in place; add a `<!-- updated: YYYY-MM-DD -->` comment.
- **Implemented items** move to the `### Archive` subsection at the bottom of their
  category — they are never deleted.

---

## Commands

| Command | What it does |
|---|---|
| `pnpm install` | Install JS deps |
| `pnpm dev` | Run the site locally at http://localhost:3000 |
| `pnpm build` / `pnpm start` | Production build, then serve it |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint, zero warnings allowed. Enforces the layer boundaries in `Harness/architecture.md` |
| `pnpm format` / `pnpm format:check` | Prettier write / check (code and config only; docs and data are ignored) |
| `pnpm test` | Vitest: LMSR engine and component tests (jsdom + Testing Library) |
| `pnpm db:generate` | Write a migration from `src/lib/db/schema.ts` into `drizzle/` (review the SQL) |
| `pnpm db:migrate` | Apply migrations to `DATABASE_URL_UNPOOLED` and create the house account |
| `pnpm db:make-admin <id>` | Make a signed-in user an admin (their id is on `/portfolio`) |
| `pnpm db:go-live <id>` | Make that user admin and open the ASL S22 final market (idempotent) |
| `pnpm test:ledger-concurrency` | 50 simultaneous trades against `DATABASE_URL_TEST` (wipes that branch) |
| `pnpm stats:fetch` | Download season and player pages from Liquipedia into `data/source/liquipedia/` (network) |
| `pnpm stats:export` | Parse the stored pages → `data/generated/*.json`, prints validation notes (offline) |
| `pnpm stats:test` | Parser and exporter tests (needs Python 3.12+, standard library only) |
