# AslMarkets.Web

Fan-made stats site and **play-money** prediction market for the ASL (StarCraft: Brood War).
Unofficial; not affiliated with the league or its broadcaster.

Start with [CLAUDE.md](CLAUDE.md) (decisions, domain rules, docs map) and [ROADMAP.md](ROADMAP.md).

## What exists today

| Piece | Where | Check |
|---|---|---|
| LMSR pricing engine | `src/lib/market/lmsr.ts` | `pnpm test` |
| Stats exporter (xlsx → JSON) | `scripts/export-stats/` | `pnpm stats:test` |
| Exported stats | `data/generated/` | `pnpm stats:export` |
| Agent harness + specs | `Harness/`, `Docs/` | — |

The Next.js app isn't scaffolded yet. That's the first Foundation item on the roadmap.

## Setup

```bash
pnpm install
pip install openpyxl          # Python 3.12+
pnpm typecheck && pnpm test && pnpm stats:test
```

## Updating stats

Edit `data/source/ASL_Complete_S1_S21.xlsx` in Excel, then:

```bash
pnpm stats:export     # prints any validation warnings
git add data && git commit
```
