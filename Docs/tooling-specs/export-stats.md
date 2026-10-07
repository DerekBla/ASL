# Tooling Spec: Stats Pipeline

**Status**: implemented
**Invocation**: `pnpm stats:fetch` (network) · `pnpm stats:export` (offline) · `pnpm stats:test`
**Location**: `scripts/liquipedia/` and `scripts/export-stats/`, each with a `tests/` folder

## Purpose

Turns Liquipedia's ASL season pages into the typed JSON the site reads (contract:
`Docs/foundation-specs/stats-data.md`). Fetching is separate from building, so the build is
offline, repeatable, and reviewable as a diff.

## Stages

```
Liquipedia API ──fetch_seasons.py──► data/source/liquipedia/sNN.wiki, index.json
               ──fetch_players.py──► data/source/liquipedia/players.json
sNN.wiki + players.json ──parse_seasons.py──► results.json, identities.json
results.json + overrides.json ──export_stats.py──► data/generated/*.json
```

| Command | Runs | Network |
|---|---|---|
| `pnpm stats:fetch` | fetch seasons → parse → fetch players → parse | yes |
| `pnpm stats:export` | parse → export | no |
| `pnpm stats:test` | parser tests, then exporter tests | no |

`export_stats.py <source_dir> <out_dir> [--strict]` exits `0` ok, `1` unusable input, `2` when
`--strict` is set and a problem code is present (see the contract for codes).

Requirements: Python 3.12+, standard library only.

## How it works

1. **Fetch** (`fetch_seasons.py`, `fetch_players.py`): MediaWiki API, one request every 3
   seconds with an identifying User-Agent, per Liquipedia's API terms. Page titles for the 21
   seasons are listed in `TITLES`. `index.json` records the revision of each page.
2. **Parse** (`parse_seasons.py`): reads group tables, match lists, the bracket, and the prize
   table from the wikitext. Handles both page styles (`SoloOpponent` through S11, `1Opponent`
   after). Group standings are computed from series results: win–loss record, then
   head-to-head, then the tiebreaker group. The pages' own standings and prize tables are a
   cross-check only; disagreements go into each season's `notes`.
3. **Identity**: two names are one person when they differ only by case or resolve to the same
   Liquipedia player page (`players.json`). The canonical spelling is Derek's confirmed one
   (`CONFIRMED` in the parser), else the player page's handle, else the latest spelling used.
4. **Export** (`export_stats.py`): applies `overrides.json`, assigns one race per player,
   computes placements, prize totals, career stats, ELO, race stats, and the series list, and
   writes deterministic JSON.

## Constraints

- Never hand-edit `data/generated/` or `results.json`. Fix the parser, or add an override.
- `overrides.json` is Derek's file. Agents propose entries; they don't add them unprompted.
- Keep sorts total-ordered (`name_key`) so output never depends on hash order.
- A new page style on Liquipedia shows up as `PARSE_PROBLEM` or `PLAYER_COUNT`. Fix the parser
  and add a test; don't patch the data.

## Adding a season

1. Add the page title to `TITLES` in `fetch_seasons.py`.
2. `pnpm stats:fetch`, then `pnpm stats:export`.
3. Check `validation.json`, review the diff, run `pnpm stats:test`, commit source and
   generated files together.

While a season is in progress its page has no final, so the exporter reports `FINALS_MISSING`
and partial placements. In-progress seasons are not supported yet (ROADMAP).
