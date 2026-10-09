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
| `manifest.json` | `{ schemaVersion, source: { kind, license, wikitextSha256, pages[] }, seasons: { count, complete }, counts, elo: { start, k, basis, games, qualifierGames, qualifierSeasons }, warnings }` |
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
  season: number;                // 1..22
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
- **ELO** is game-based (Derek, 2026-10-09): start 1500, K=32, one update per game (map) in the
  order played. A series with no games listed is rebuilt from its score, the loser's wins spread
  between the winner's; with no score it counts as one game. Two versions are exported for each
  player: the ASL's own games (`currentElo`, `games`, `history`) and the same with each season's
  qualifier games played first (`withQualifiers`, S4 on). Peak is the best rating at the end of a
  season. Only players who entered an ASL season are listed. The algorithm is `compute_game_elo`
  in the exporter. Qualifier series come from `data/source/liquipedia/qualifier-results.json`
  (`pnpm stats:qualifiers`, then `pnpm stats:export`); forfeits and walkovers are left out, and a
  qualifier name is matched to an ASL player only by exact ID.
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

## Schema version 4 (2026-10-09)

New in this version. Field by field types are in `src/lib/services/stats/schemas.ts`.

- `series.json`: `elo: { winnerBefore, winnerAfter, loserBefore, loserAfter }`. Each player's
  ELO (ASL games only) going into the series and coming out. The two changes mirror each other.
  The winner of a series can lose points (a 4–3 win over a much lower rated player).
- `elo.json`: `vsRace: { T, Z, P }`, each `{ elo, games, wins }`. The same ELO counting only the
  games against that race (`compute_matchup_elo`), so each of the six matchups is rated alone.
  `elo` is null with no games. The site shows a matchup rating from 10 games (`MIN_MATCHUP_GAMES`).
- `player-stats.json`: `gamesWon`, `gamesLost`.
- `manifest.json` `elo`: `favoriteGames`, `favoriteWins` (how often the higher rated player won)
  and `probabilityScale`, the factor on a rating gap that makes the games played most likely
  (`fit_probability_scale`). Chances shown on the site use it: see `getWinChance`.
- `maps.json` (new): one row per map with a named game. `games`, `seasons`, `matchups` (Terran
  against Zerg, Zerg against Protoss, Protoss against Terran, from the first race's side),
  `mirrors`, `unknownRace`, and `players` (each player's wins and losses there). Group games are
  covered for every season; playoff maps only where the page lists them (S9, S12 on).
- `records.json` (new): `gameStreaks` and `seriesStreaks` (ten each, with `active` for a run
  still going), `upsets` (series won by the lower rated player, widest gap first, ten),
  `titleRuns` (each champion's games in the season they won), `championAges` (age on the day of
  the final, from the birth date on the player's Liquipedia page; `players.json` in the source
  folder now stores `birth`).

Game order inside a series that has only a score is rebuilt (`games_of`), so a game streak
through one of the 78 older playoff series can be off by a game. The records page says so.

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

## A season in progress

The newest season may be exported before it ends (Derek, 2026-10-09; S22 was added with its final
still to play). What changes for that season:

- `status` is `in_progress`, and `winner`, `runnerUp` and `finalScore` are null.
- `upcoming` lists playoff series that are set but not played: the round and the two players. The
  season page draws them in the bracket with no score.
- The players in those series get a **provisional** placement covering the places still open to
  them (`1st–2nd` for finalists, `1st–4th` for semifinalists), with `status: "provisional"` and no
  prize. A provisional placement never counts as a championship.
- ELO counts the games played so far.
- The export prints an `IN_PROGRESS` note for the season. It is not a problem under `--strict`.

`pnpm stats:refresh` does all of the following in one go and runs on a schedule
(`Docs/tooling-specs/stats-refresh.md`). By hand:
`pnpm stats:season 22`, then `pnpm stats:export`, check the notes, run the tests, deploy.
Add `pnpm stats:vods 22` for new casts. This has been used with the group stages finished; a season
caught in the middle of a group stage has not been tried, and its unfinished groups will produce
notes that need reading before the result is published. A new season also needs its page title
added to `TITLES` in `scripts/liquipedia/fetch_seasons.py`.
