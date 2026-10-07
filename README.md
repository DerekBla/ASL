# StarCoins

Fan-made stats site and **play-money** prediction market for the ASL (StarCraft: Brood War).
Unofficial; not affiliated with the league or its broadcaster.

Start with [CLAUDE.md](CLAUDE.md) (decisions, domain rules, docs map) and [ROADMAP.md](ROADMAP.md).

## What exists today

| Piece | Where | Check |
|---|---|---|
| Next.js 15 app shell | `src/app/`, `src/components/` | `pnpm dev`, `pnpm build` |
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
