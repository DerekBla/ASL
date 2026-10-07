# Foundation Spec: Stats Data Contract

**Status**: implemented (export) · draft (TypeScript loader)
**Last updated**: 2026-10-06
**Producer**: `scripts/export-stats/export_stats.py` (see `Docs/tooling-specs/export-stats.md`)
**Consumer**: `src/lib/services/stats/` (to build — Zod schemas mirror this file)

## Source of truth

`data/source/ASL_Complete_S1_S21.xlsx`, maintained by Derek in Excel. Tabs: Season Overview,
Player Placements, ELO Ratings, Player Stats, Race Stats, S21 Live Tracker. The exporter
reads it with `data_only=True` (cached values; the workbook has no formulas today).

The export is **faithful**: it does not correct data. Problems are reported in
`validation.json` and fixed in the workbook.

## Files in `data/generated/` (all UTF-8, sorted keys, committed)

| File | Shape |
|---|---|
| `manifest.json` | `{ schemaVersion, source: { file, sha256 }, seasons: { count, complete }, counts: {…}, ignoredSheets, warnings }` |
| `seasons.json` | `Season[]` |
| `players.json` | `{ player, race }[]` (unique by name as written) |
| `placements.json` | `Placement[]` long form, one row per player-season entered |
| `elo.json` | `EloRow[]` |
| `player-stats.json` | `PlayerStats[]` |
| `race-stats.json` | `{ overall, championshipsByEra, participantsBySeason, playoffSeriesS13toS20, grandFinalsByMatchup, playoffMatrixS13toS20, finalsBySeason, matchupsAllStages, matchupsAllStagesMirror, matrixAllStages }` |
| `live-tracker.json` | `{ lastUpdatedNote, rows: TrackerRow[] }` |
| `validation.json` | `{ code, message }[]` |

### Types

```ts
type Race = "T" | "Z" | "P";

type PlacementValue = {
  label: string;                 // "1st", "9th–12th" (en-dash), "In progress"
  best: number | null;           // 9 for "9th–12th"; null when in progress
  worst: number | null;          // 12
  status: "final" | "in_progress";
};

type Season = {
  season: number;                // 1..21
  name: string;                  // "ASL S1 (BW)", "SSL AUTUMN"
  start: string; end: string;    // ISO dates as written
  prizePoolKrw: number | null;
  prizePoolUsdApprox: number | null;
  winner: string | null; winnerRace: Race | null;
  runnerUp: string | null; runnerUpRace: Race | null;
  notes: string | null;
  status: "complete" | "in_progress";   // derived: winner known
};

type Placement = { player: string; race: Race; season: number; placement: PlacementValue };

type EloRow = { rank: number; player: string; race: Race; currentElo: number; peakElo: number;
  peakSeason: number | null; seasons: number; championships: number };

type PlayerStats = { player: string; race: Race; seasons: number; bestFinish: PlacementValue;
  championships: number; finals: number; semifinalsOrBetter: number;
  quarterfinalsOrBetter: number; estPrizeKrw: number | null; currentElo: number };

type WinLoss = { wins: number; losses: number; winRate: number | null };   // matrix cells
```

Ratios are 0–1 numbers (`"40.0%"` → `0.4`). Mirror diagonal cells (`--`) are `null`.

## Scope notes

- ELO and Player Stats cover **S1–S20** (completed seasons). Placements cover S1–S21.
  The "Played" column in Player Placements counts S21 eliminations, and Player Stats
  "Seasons" doesn't; both are correct for their scope.
- Race Stats "Win Rate" in the overall table is **share of titles**, exported as `titleShare`.
- Player names are exported **as written**. Identity merging happens later through an
  approved alias map (Data roadmap), never silently.

## Changing the contract

Bump `SCHEMA_VERSION` in the exporter on any breaking shape change. Update this file and the
Zod schemas in the same PR. The loader must refuse a `manifest.schemaVersion` it doesn't know.
