/**
 * Stats loader: the only code that reads data/generated/ (data-1).
 *
 * Server only. The JSON is bundled at build time, validated once, and cached for the life of
 * the process. Pages call the get* functions from React Server Components.
 */
import "server-only";

import { playerSlug } from "@/lib/utils/slug";

import elo from "../../../../data/generated/elo.json";
import manifest from "../../../../data/generated/manifest.json";
import placements from "../../../../data/generated/placements.json";
import playerStats from "../../../../data/generated/player-stats.json";
import players from "../../../../data/generated/players.json";
import raceStats from "../../../../data/generated/race-stats.json";
import seasons from "../../../../data/generated/seasons.json";
import series from "../../../../data/generated/series.json";
import validation from "../../../../data/generated/validation.json";
import { parseStats } from "./parse";
import type { StatsData } from "./parse";
import type {
  EloRow,
  Manifest,
  Placement,
  Player,
  PlayerStats,
  RaceStats,
  Season,
  Series,
  ValidationNote,
} from "./schemas";

export { StatsDataError } from "./parse";
export { playerSlug } from "@/lib/utils/slug";
export type {
  EloRow,
  Manifest,
  Matchups,
  Placement,
  PlacementValue,
  Player,
  PlayerStats,
  RaceStats,
  Season,
  Series,
  ValidationNote,
} from "./schemas";

type Indexed = StatsData & {
  seasonByNumber: Map<number, Season>;
  playerByName: Map<string, Player>;
  playerByAlias: Map<string, Player>;
  statsByPlayer: Map<string, PlayerStats>;
  eloByPlayer: Map<string, EloRow>;
  placementsByPlayer: Map<string, Placement[]>;
  placementsBySeason: Map<number, Placement[]>;
  seriesBySeason: Map<number, Series[]>;
  playerBySlug: Map<string, Player>;
  seriesByPlayer: Map<string, Series[]>;
};

/** Everything two players did against each other, and in the seasons both entered. */
export type HeadToHead = {
  a: Player;
  b: Player;
  /** Series between the two, oldest first. */
  series: readonly Series[];
  winsA: number;
  winsB: number;
  /** Seasons both entered, with each player's placement. */
  sharedSeasons: readonly { season: number; a: Placement; b: Placement }[];
  /** Shared seasons in which each finished in a strictly better tier than the other. */
  finishedAboveA: number;
  finishedAboveB: number;
};

let cache: Indexed | undefined;

function groupBy<K, V>(rows: readonly V[], key: (row: V) => K): Map<K, V[]> {
  const out = new Map<K, V[]>();
  for (const row of rows) {
    const k = key(row);
    const list = out.get(k);
    if (list) list.push(row);
    else out.set(k, [row]);
  }
  return out;
}

function load(): Indexed {
  if (cache) return cache;
  const data = parseStats({
    manifest,
    seasons,
    players,
    placements,
    series,
    elo,
    playerStats,
    raceStats,
    validation,
  });
  const playerByAlias = new Map<string, Player>();
  const playerBySlug = new Map<string, Player>();
  for (const p of data.players) {
    for (const name of [p.player, ...p.aliases]) playerByAlias.set(name.toLowerCase(), p);
    const slug = playerSlug(p.player);
    const clash = playerBySlug.get(slug);
    if (clash)
      throw new Error(`players "${clash.player}" and "${p.player}" share the URL slug "${slug}"`);
    playerBySlug.set(slug, p);
  }
  const seriesByPlayer = new Map<string, Series[]>();
  for (const row of data.series) {
    for (const name of [row.winner, row.loser]) {
      const list = seriesByPlayer.get(name);
      if (list) list.push(row);
      else seriesByPlayer.set(name, [row]);
    }
  }
  cache = {
    ...data,
    seasonByNumber: new Map(data.seasons.map((s) => [s.season, s])),
    playerByName: new Map(data.players.map((p) => [p.player, p])),
    playerByAlias,
    statsByPlayer: new Map(data.playerStats.map((r) => [r.player, r])),
    eloByPlayer: new Map(data.elo.map((r) => [r.player, r])),
    placementsByPlayer: groupBy(data.placements, (r) => r.player),
    placementsBySeason: groupBy(data.placements, (r) => r.season),
    seriesBySeason: groupBy(data.series, (r) => r.season),
    playerBySlug,
    seriesByPlayer,
  };
  return cache;
}

export function getManifest(): Manifest {
  return load().manifest;
}

/** Seasons in order, S1 first. */
export function getSeasons(): readonly Season[] {
  return load().seasons;
}

export function getSeason(season: number): Season | undefined {
  return load().seasonByNumber.get(season);
}

/** The most recent completed season, if any. */
export function getLatestCompleteSeason(): Season | undefined {
  return load()
    .seasons.filter((s) => s.status === "complete")
    .at(-1);
}

/** Players in name order. */
export function getPlayers(): readonly Player[] {
  return load().players;
}

/** Looks a player up by their canonical name (exact match). */
export function getPlayer(name: string): Player | undefined {
  return load().playerByName.get(name);
}

/** Looks a player up by canonical name or any alias, ignoring case. */
export function findPlayer(nameOrAlias: string): Player | undefined {
  return load().playerByAlias.get(nameOrAlias.toLowerCase());
}

export function getPlacements(): readonly Placement[] {
  return load().placements;
}

/** One player's placements, oldest season first. */
export function getPlacementsForPlayer(name: string): readonly Placement[] {
  return load().placementsByPlayer.get(name) ?? [];
}

/** One season's placements, best finish first. */
export function getPlacementsForSeason(season: number): readonly Placement[] {
  return load().placementsBySeason.get(season) ?? [];
}

export function getSeries(): readonly Series[] {
  return load().series;
}

export function getSeriesForSeason(season: number): readonly Series[] {
  return load().seriesBySeason.get(season) ?? [];
}

/** ELO table in rank order. Placement-based: label it that way in the UI. */
export function getElo(): readonly EloRow[] {
  return load().elo;
}

export function getEloForPlayer(name: string): EloRow | undefined {
  return load().eloByPlayer.get(name);
}

/** Career stats, highest current ELO first. */
export function getPlayerStats(): readonly PlayerStats[] {
  return load().playerStats;
}

export function getStatsForPlayer(name: string): PlayerStats | undefined {
  return load().statsByPlayer.get(name);
}

export function getRaceStats(): RaceStats {
  return load().raceStats;
}

/** Notes the exporter recorded about the source data. */
export function getValidationNotes(): readonly ValidationNote[] {
  return load().validation;
}

/** Looks a player up by the slug used in /players/[slug] URLs. */
export function getPlayerBySlug(slug: string): Player | undefined {
  return load().playerBySlug.get(slug);
}

/** Every series a player played (group stage and playoffs), oldest season first. */
export function getSeriesForPlayer(name: string): readonly Series[] {
  return load().seriesByPlayer.get(name) ?? [];
}

/**
 * Head-to-head between two players, by canonical name or alias. Returns undefined when either
 * name is unknown or both are the same player.
 */
export function getHeadToHead(nameA: string, nameB: string): HeadToHead | undefined {
  const a = findPlayer(nameA);
  const b = findPlayer(nameB);
  if (!a || !b || a.player === b.player) return undefined;
  const series = getSeriesForPlayer(a.player).filter(
    (s) => s.winner === b.player || s.loser === b.player,
  );
  const placementsB = new Map(getPlacementsForPlayer(b.player).map((p) => [p.season, p]));
  const sharedSeasons = getPlacementsForPlayer(a.player).flatMap((pa) => {
    const pb = placementsB.get(pa.season);
    return pb ? [{ season: pa.season, a: pa, b: pb }] : [];
  });
  return {
    a,
    b,
    series,
    winsA: series.filter((s) => s.winner === a.player).length,
    winsB: series.filter((s) => s.winner === b.player).length,
    sharedSeasons,
    finishedAboveA: sharedSeasons.filter((x) => x.a.placement.worst < x.b.placement.best).length,
    finishedAboveB: sharedSeasons.filter((x) => x.b.placement.worst < x.a.placement.best).length,
  };
}
