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

Markets need a database (Neon) and sign-in (Clerk). Without them the site runs as a stats site
and the market pages say "Markets are warming up".

1. **Neon** (neon.tech, free): create a project. From *Connect*, copy the pooled connection
   string into `DATABASE_URL` and the direct one into `DATABASE_URL_UNPOOLED`. Under
   *Branches*, create a branch called `test` and put its connection string in
   `DATABASE_URL_TEST` (the concurrency test wipes that branch, so never point it at the main one).
2. **Clerk** (clerk.com, free): create an application named StarCoins with only **Google** and
   **Discord** sign-in (turn off email and password). Copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   and `CLERK_SECRET_KEY`.
3. Copy `.env.example` to `.env.local` and fill in those five values. `.env.local` is never committed.
4. Create the tables, then check the ledger against real Postgres:
   ```bash
   corepack pnpm db:migrate
   corepack pnpm test:ledger-concurrency
   ```
5. `corepack pnpm dev`, open http://localhost:3000, sign in. You get 100 minerals. Your player
   id is at the bottom of `/portfolio`. Make yourself an admin:
   ```bash
   corepack pnpm db:make-admin <your-player-id>
   ```
6. Open `/admin`, click **Fill in: ASL S22 Grand Final**, check the details, and create the
   market. After the final, resolve it from `/admin` with the winner.

For other people to trade, the site has to be deployed (Vercel, ROADMAP: CI pipeline) with the
same five values set there, and the Clerk app switched to a production instance for that domain.
