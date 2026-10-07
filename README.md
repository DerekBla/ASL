# AslMarkets.Web

Fan-made stats site and **play-money** prediction market for the ASL (StarCraft: Brood War).
Unofficial; not affiliated with the league or its broadcaster.

Start with [CLAUDE.md](CLAUDE.md) (decisions, domain rules, docs map) and [ROADMAP.md](ROADMAP.md).

## What exists today

| Piece | Where | Check |
|---|---|---|
| LMSR pricing engine | `src/lib/market/lmsr.ts` | `pnpm test` |
| Stats pipeline (Liquipedia → JSON) | `scripts/liquipedia/`, `scripts/export-stats/` | `pnpm stats:test` |
| Exported stats | `data/generated/` | `pnpm stats:export` |
| Agent harness + specs | `Harness/`, `Docs/` | — |

The Next.js app isn't scaffolded yet. That's the first Foundation item on the roadmap.

## Setup

```bash
pnpm install
# Python 3.12+ on PATH (standard library only)
pnpm typecheck && pnpm test && pnpm stats:test
```

## Updating stats

Stats are built from Liquipedia's ASL season pages (CC-BY-SA 3.0), stored in `data/source/liquipedia/`.
To refresh them run `pnpm stats:fetch`, then:

```bash
pnpm stats:export     # prints any validation warnings
git add data && git commit
```
