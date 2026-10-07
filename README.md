# StarCoins

Fan-made stats site and **play-money** prediction market for the ASL (StarCraft: Brood War).
Unofficial; not affiliated with the league or its broadcaster.

Start with [CLAUDE.md](CLAUDE.md) (decisions, domain rules, docs map) and [ROADMAP.md](ROADMAP.md).

## What exists today

| Piece | Where | Check |
|---|---|---|
| Next.js 15 app shell | `src/app/`, `src/components/` | `pnpm dev`, `pnpm build` |
| Markets: trade panel, portfolio, leaderboard, admin | `src/app/markets/`, `src/features/` | `pnpm test` |
| Minerals ledger (Postgres) | `src/lib/services/ledger/`, `drizzle/` | `pnpm test`, `pnpm test:ledger-concurrency` |
| Stats pages: seasons, players, ELO, races, head-to-head | `src/app/`, `src/features/stats/` | `pnpm test`, `pnpm dev` |
| Stats loader (Zod-validated) | `src/lib/services/stats/` | `pnpm test` |
| Design tokens (Tailwind v4) | `src/app/globals.css` | `pnpm test` |
| LMSR pricing engine | `src/lib/market/lmsr.ts` | `pnpm test` |
| Stats pipeline (Liquipedia → JSON) | `scripts/liquipedia/`, `scripts/export-stats/` | `pnpm stats:test` |
| Exported stats | `data/generated/` | `pnpm stats:export` |
| Agent harness + specs | `Harness/`, `Docs/` | — |

The Next.js app is scaffolded (`src/app/`): seasons, players, ELO, race stats, and a head-to-head lookup, all built from the stats data. Stats pages and
markets come next; see the roadmap.

## Setup

```bash
pnpm install
# Python 3.12+ on PATH (standard library only)
pnpm dev                      # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm stats:test && pnpm build
```

## Updating stats

Stats are built from Liquipedia's ASL season pages (CC-BY-SA 3.0), stored in `data/source/liquipedia/`.
To refresh them run `pnpm stats:fetch`, then:

```bash
pnpm stats:export     # prints any validation warnings
git add data && git commit
```

## Turning markets on

Markets need a database (Neon), sign-in (Clerk) and a host (Vercel). Without them the site
runs as a stats site and the market pages say "Markets are warming up". Neon and Clerk are
added through Vercel's marketplace, which creates both accounts and sets all the keys.

**Steps only Derek can do** (logins and legal terms need a person), in a terminal in this folder:

```bash
npx vercel login                    # opens the browser
npx vercel link                     # create a project called starcoins
npx vercel integration add neon     # accept the terms; creates the database
npx vercel integration add clerk    # accept the terms; creates the sign-in app
```

In the Clerk dashboard (open it from the Vercel project's Integrations tab): under
*User & authentication → SSO connections* turn on **Google** and **Discord**, and under
*Email, phone, username* turn off email and password sign-in.

**Steps an agent can then do:**

```bash
npx vercel env pull .env.local      # the keys, for local scripts
corepack pnpm db:migrate            # tables + house account
npx vercel deploy --prod            # publish
```

**Last step:** Derek signs in on the live site (100 minerals), copies the player id from the
bottom of `/portfolio`, and runs (or asks an agent to run):

```bash
corepack pnpm db:go-live <player-id>   # makes him admin and opens the ASL S22 final market
```

After the final, resolve the market from `/admin` with the winner.

Notes: `pnpm test:ledger-concurrency` wipes the database it points at, so give it a separate
Neon branch in `DATABASE_URL_TEST`, never the live one. A Clerk development instance works on
the `*.vercel.app` address and shows a small "development mode" badge; a production instance
needs a custom domain.
