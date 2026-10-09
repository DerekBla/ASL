# Foundation Spec: Stats Data Contract

**Status**: implemented (export and TypeScript loader, schema version 3)
**Last updated**: 2026-10-07
**Producer**: `scripts/export-stats/export_stats.py` (see `Docs/tooling-specs/export-stats.md`)
**Consumer**: `src/lib/services/stats/` — `schemas.ts` mirrors this file with strict Zod objects, so a field
added or renamed by the exporter fails the build until the schema and this file are updated

## Source of truth

Liquipedia's ASL season pages, stored as wikitext in `data/source/liquipedia/sNN.wiki` and
parsed into `data/source/liquipedia/results.json`. Derek's corrections sit on top in
`data/source/overrides.json`. Liquipedia text is CC-BY-SA 3.0; the site must credit it.

The workbook (`data/source/ASL_Complete_S1_S21.xlsx`) was the source until 2026-10-07. An
audit found it matched Liquipedia on 486 of 576 entries
(`Docs/reports/2026-10-07-liquipedia-audit.md`), so it is now a reference copy only. Nothing
reads it.

Placements come from **match results** (group series and the bracket), not from the pages'
summary tables, which are occasionally wrong. Everything derived (ELO, career stats, race
stats) is computed by the exporter.

## Files in `data/generated/` (all UTF-8, LF, sorted keys, committed)

| File | Shape |
|---|---|
| `manifest.json` | `{ schemaVersion, source: { kind, license, wikitextSha256, pages[] }, seasons: { count, complete }, counts, elo: { start, k, basis }, warnings }` |
| `seasons.json` | `Season[]` |
| `players.json` | `Player[]` |
| `placements.json` | `Placement[]`, one row per player per season entered |
| `series.json` | `Series[]`, every group and playoff series |
| `elo.json` | `EloRow[]`, ordered by rank |
| `player-stats.json` | `PlayerStats[]`, ordered by current ELO |
| `race-stats.json` | `RaceStats` |
| `validation.json` | `{ code, message }[]` |

### Types

```ts
type Race = "T" | "Z" | "P";

type PlacementValue = {
  label: string;                 // "1st", "9th–12th" (en-dash)
  best: number; worst: number;   // 9 and 12 for "9th–12th"
  status: "final";
};

type Season = {
  season: number;                // 1..21
  name: string;                  // as Liquipedia's infobox has it, e.g. "ASL Season 5"
  start: string; end: string;    // ISO dates
  prizePoolKrw: number | null;
  players: number;               // 16 in S1, 28 after
  winner: string | null; winnerRace: Race | null;
  runnerUp: string | null; runnerUpRace: Race | null;
  finalScore: string | null;     // "4-3"
  thirdPlaceMatch: boolean;      // S3–S14. Without one, both semifinal losers are "3rd"
  status: "complete" | "in_progress";
  // Casts of a playoff round that are titled by broadcast day (S2–S8, S10), so no one series owns them
  roundVods: { round: "quarterfinal" | "semifinal"; label: string; url: string }[];
  source: { title: string; url: string; revid: number };
};

type Player = { player: string; race: Race | null; aliases: string[] };

type Placement = { player: string; race: Race | null; season: number;
  placement: PlacementValue; prizeKrw: number | null };

type Series = { season: number; stage: "ro24" | "ro16" | "playoffs";
  round: string;                 // "Group A", "quarterfinal", "semifinal", "final", "third_place"
  winner: string; loser: string; winnerRace: Race | null; loserRace: Race | null;
  score: string | null;          // playoffs only, e.g. "3-1"
  // Games in the order played. Empty when the page lists none (playoffs before S9, bar S9);
  // map is null when the page names none
  games: { map: string | null; winner: string }[];
  // English cast on YouTube (SOOP esports EN), starting at this series when the page says where.
  // A group series without its own link carries its group's cast. Null when none is known
  vod: string | null };

type EloRow = { rank: number; player: string; race: Race | null; currentElo: number;
  peakElo: number; peakSeason: number; seasons: number; championships: number;
  history: { season: number; elo: number }[] };   // after each season entered, oldest first (v3)

type PlayerStats = { player: string; race: Race | null; seasons: number;
  bestFinish: PlacementValue; championships: number; finals: number;
  semifinalsOrBetter: number; quarterfinalsOrBetter: number;
  prizeKrw: number; currentElo: number };

type Matchups = {
  crossRace: { race: Race; vs: Race; wins: number; losses: number; winRate: number | null }[];
  mirrors: { TvT: number; ZvZ: number; PvP: number };
  unknownRace: number;           // series involving a player with no race
};

type RaceStats = {
  overall: { race: Race; championships: number; runnerUps: number; finalsAppearances: number;
    titleShare: number | null; participantSeasons: number; participantShare: number | null }[];
  participantsBySeason: { season: number; T: number; Z: number; P: number; unknown: number; total: number }[];
  finalsBySeason: { season: number; champion: string | null; championRace: Race | null;
    runnerUp: string | null; runnerUpRace: Race | null; score: string | null }[];
  seriesByMatchup: { allStages: Matchups; playoffs: Matchups; finals: Matchups };
};
```

Ratios are 0–1 numbers.

## Rules the data follows

- **One race per player**, the one Liquipedia shows most often, unless `overrides.json` sets
  it. A player with no race anywhere is `null` and gets an `UNKNOWN_RACE` note.
- **One name per person.** Spellings and renames that share a Liquipedia player page are
  merged; the others are listed in `aliases`. Derek's confirmed spellings (CLAUDE.md Domain
  Rules) win over Liquipedia's.
- **Placement tiers**: 1st, 2nd, 3rd/4th (or two 3rds), 5th–8th, then 9th–12th and 13th–16th
  for third and fourth in a Ro16 group, 17th–22nd and 23rd–28th for a Ro24 group.
- **Prize money** is the payout Liquipedia lists for that placement in that season, in KRW.
  No USD values are exported.
- **ELO** is placement-based, not match-based: start 1500, K=32. Each season every pair of
  players in different placement tiers counts as one game won by the better-placed player.
  Label it that way in the UI. The algorithm is `compute_elo` in the exporter.
- **Race stats count series, not games**: a best-of-seven final is one series.

## Reading the data in the app

Only `src/lib/services/stats/` reads `data/generated/` (data-1). It is server-only: the JSON
is bundled at build time, validated once, and cached. Pages call it from Server Components:

```ts
import { getSeason, getPlacementsForSeason, findPlayer } from "@/lib/services/stats";
```

| Function | Returns |
|---|---|
| `getManifest()` | Schema version, source revisions, counts |
| `getSeasons()` · `getSeason(n)` · `getLatestCompleteSeason()` | Seasons, S1 first |
| `getPlayers()` · `getPlayer(name)` · `findPlayer(nameOrAlias)` | Players; `findPlayer` matches aliases and ignores case |
| `getPlacements()` · `getPlacementsForPlayer(name)` · `getPlacementsForSeason(n)` | Placements |
| `getSeries()` · `getSeriesForSeason(n)` | Every group and playoff series |
| `getElo()` · `getEloForPlayer(name)` | ELO table |
| `getPlayerStats()` · `getStatsForPlayer(name)` | Career stats |
| `getRaceStats()` · `getValidationNotes()` | Race stats; exporter notes |

A mismatch with the contract throws `StatsDataError` and fails the build. That is deliberate:
the data is static, so there is no runtime state a page could recover into.

## Validation codes

| Code | Meaning | Fails `--strict` |
|---|---|---|
| `PARSE_PROBLEM` | A match or group could not be read, or totals disagree | yes |
| `PLAYER_COUNT` | A season does not have 28 players (16 for S1) | yes |
| `FINALS_MISSING` | No grand final result | yes |
| `SOURCE_TABLE_MISMATCH` | A Liquipedia summary table disagrees with its match results | no |
| `UNKNOWN_RACE` | No race found; add it to `overrides.json` | no |
| `RACE_VARIES` / `RACE_OVERRIDDEN` / `OVERRIDE_UNUSED` | Informational | no |

## Changing the contract

Bump `SCHEMA_VERSION` in the exporter on any breaking shape change. Update this file and the
Zod schemas in the same PR. The loader must refuse a `manifest.schemaVersion` it doesn't know.

## Maps and VODs

Maps come from the `{{Map}}` entries of each match on the season page, in the order played;
skipped games are left out. Map names drop the wiki's page suffix (`Tempest (Map)` → `Tempest`).

VODs are links to the English casts on YouTube. `scripts/liquipedia/parse_seasons.py` picks one
per group and per playoff series, in this order:

1. A YouTube link on the Liquipedia page (`vod`, `vodgameN`, or a map's `vod`), kept with its
   start time. Links to other sites (the Korean SOOP broadcast) are ignored.
2. Otherwise a video of the SOOP esports EN channel whose title names the season and the group
   (`Ro.24 Group A`) or the two players of a playoff series (`title_slot`, `Vods`).
3. Playoff casts titled only by broadcast day go to the match of the same number in their round
   (day 1 is the first quarterfinal; Derek, 2026-10-08). Any left over become the
   season's `roundVods`.

`data/source/youtube/videos.json` lists every video known to exist, with title and channel, and
the linked videos that are gone. It is built by `pnpm stats:vods` (`scripts/youtube/fetch_vods.py`),
which checks each linked video with YouTube's oEmbed endpoint and searches the channel once per
season and stage. A link to a video that is gone is never exported. Run `pnpm stats:vods` and then
`pnpm stats:export` after a season ends.
