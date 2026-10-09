/**
 * Stats loader: the only code that reads data/generated/ (data-1).
 *
 * Server only. The JSON is bundled at build time, validated once, and cached for the life of
 * the process. Pages call the get* functions from React Server Components.
 */
import "server-only";

import { eloWinProbability } from "@/lib/market/priors";
import { mapSlug, playerSlug } from "@/lib/utils/slug";

import elo from "../../../../data/generated/elo.json";
import manifest from "../../../../data/generated/manifest.json";
import maps from "../../../../data/generated/maps.json";
import placements from "../../../../data/generated/placements.json";
import playerStats from "../../../../data/generated/player-stats.json";
import players from "../../../../data/generated/players.json";
import raceStats from "../../../../data/generated/race-stats.json";
import records from "../../../../data/generated/records.json";
import seasons from "../../../../data/generated/seasons.json";
import series from "../../../../data/generated/series.json";
import validation from "../../../../data/generated/validation.json";
import { parseStats } from "./parse";
import type { StatsData } from "./parse";
import type {
  EloRow,
  Manifest,
  MapStats,
  Placement,
  Player,
  PlayerStats,
  RaceStats,
  Records,
  Season,
  Series,
  ValidationNote,
} from "./schemas";

export { StatsDataError } from "./parse";
export { buildBracket, buildGroupStages } from "./stages";
export type { Bracket, BracketMatch, BracketSide, GroupStage, StageGroup } from "./stages";
export { mapSlug, playerSlug } from "@/lib/utils/slug";
export type {
  EloRow,
  Manifest,
  MapStats,
  Matchups,
  Records,
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
  mapBySlug: Map<string, MapStats>;
  mapsByPlayer: Map<string, PlayerMapRecord[]>;
};

/** One player's games on one map. */
export type PlayerMapRecord = { map: string; wins: number; losses: number };

/** A matchup rating needs this many games before the site ranks it. */
export const MIN_MATCHUP_GAMES = 10;

/** What the ratings say about a game between two players. */
export type WinChance = {
  /**
   * Chance that A wins one game, from the two current ELO ratings (ASL games only), with the
   * gap scaled by manifest.elo.probabilityScale so it matches how games have actually gone.
   */
  game: number;
  eloA: number;
  eloB: number;
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
    maps,
    records,
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
  const mapBySlug = new Map<string, MapStats>();
  const mapsByPlayer = new Map<string, PlayerMapRecord[]>();
  for (const m of data.maps) {
    const slug = mapSlug(m.map);
    const clash = mapBySlug.get(slug);
    if (clash) throw new Error(`maps "${clash.map}" and "${m.map}" share the URL slug "${slug}"`);
    mapBySlug.set(slug, m);
    for (const p of m.players) {
      const row = { map: m.map, wins: p.wins, losses: p.losses };
      const list = mapsByPlayer.get(p.player);
      if (list) list.push(row);
      else mapsByPlayer.set(p.player, [row]);
    }
  }
  cache = {
    ...data,
    mapBySlug,
    mapsByPlayer,
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

/** The season being played now, if the newest one has no champion yet. */
export function getSeasonInProgress(): Season | undefined {
  const newest = load().seasons.at(-1);
  return newest?.status === "in_progress" ? newest : undefined;
}

/**
 * How long a playoff round's series are, read from the most recent one played with a score
 * (the format has changed over the years, so the newest is the best guide).
 */
export function getBestOf(round: Season["upcoming"][number]["round"]): number | undefined {
  const last = load()
    .series.filter((s) => s.stage === "playoffs" && s.round === round && s.score !== null)
    .at(-1);
  const wins = Number(last?.score?.split("-")[0]);
  return Number.isInteger(wins) && wins > 0 ? wins * 2 - 1 : undefined;
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

/** ELO table in rank order. Game based, ASL games only: say so wherever it is shown. */
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

/** Every map with a named game, most played first. */
export function getMaps(): readonly MapStats[] {
  return load().maps;
}

/** Looks a map up by the slug used in /maps/[slug] URLs. */
export function getMapBySlug(slug: string): MapStats | undefined {
  return load().mapBySlug.get(slug);
}

/** One player's record on every map they have a named game on, most played map first. */
export function getMapsForPlayer(name: string): readonly PlayerMapRecord[] {
  return load().mapsByPlayer.get(name) ?? [];
}

export function getRecords(): Records {
  return load().records;
}

/**
 * What the ratings say about one game between two players, by canonical name or alias.
 * Undefined when either is unknown or they are the same player.
 */
export function getWinChance(nameA: string, nameB: string): WinChance | undefined {
  const a = findPlayer(nameA);
  const b = findPlayer(nameB);
  const eloA = a && getEloForPlayer(a.player);
  const eloB = b && getEloForPlayer(b.player);
  if (!a || !b || !eloA || !eloB || a.player === b.player) return undefined;
  return {
    game: eloWinProbability(eloA.currentElo, eloB.currentElo, load().manifest.elo.probabilityScale),
    eloA: eloA.currentElo,
    eloB: eloB.currentElo,
  };
}

/**
 * Players matching what someone typed. An exact name or old spelling gives that one player.
 * Otherwise every player whose name or old spelling contains the text, names that start with
 * it first.
 */
export function searchPlayers(query: string): readonly Player[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const exact = load().playerByAlias.get(q);
  if (exact) return [exact];
  const rank = (p: Player): number => {
    const names = [p.player, ...p.aliases].map((n) => n.toLowerCase());
    if (names.some((n) => n.startsWith(q))) return 0;
    return names.some((n) => n.includes(q)) ? 1 : 2;
  };
  return load()
    .players.filter((p) => rank(p) < 2)
    .sort((x, y) => rank(x) - rank(y) || x.player.localeCompare(y.player));
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
