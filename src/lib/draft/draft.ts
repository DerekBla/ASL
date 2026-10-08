/**
 * Fantasy draft rules (Docs/feature-specs/drafts.md). Pure: no I/O, no clock, no DB types.
 *
 * A league drafts the players of one season's pick'em in snake order, then each team scores
 * one point for every game (map) its players win during the season (Derek, 2026-10-08).
 */
import { z } from "zod";

import { eliminations, isComplete } from "@/lib/pickem/scoring";
import type { PickemConfig, Selection } from "@/lib/pickem/types";
import { RACES } from "@/lib/types/race";

/** Seconds a manager has to pick before the best player left is picked for them. */
export const PICK_SECONDS = 60;
export const MIN_DRAFT_MEMBERS = 2;
export const MAX_DRAFT_MEMBERS = 12;

export type DraftStatus = "lobby" | "drafting" | "drafted";

/** The season's players, best first. An expired turn takes the first one still free. */
export const draftPoolSchema = z.array(
  z.strictObject({ player: z.string().min(1).max(60), race: z.enum(RACES).nullable() }),
);
export const draftOrderSchema = z.array(z.string().min(1));

export type PoolPlayer = z.infer<typeof draftPoolSchema>[number];

/** Games won this season, by player. A player not listed has won none. */
export const gameWinsSchema = z.record(z.string().min(1).max(60), z.number().int().min(0).max(999));

export type GameWins = z.infer<typeof gameWinsSchema>;

/** Team sizes a league of this many managers can choose: every team must be fillable. */
export function teamSizeOptions(poolSize: number, members: number): number[] {
  if (members < 1) return [];
  return Array.from({ length: Math.floor(poolSize / members) }, (_, i) => i + 1);
}

export function totalDraftPicks(members: number, teamSize: number): number {
  return members * teamSize;
}

/** Snake order: 1 2 3, 3 2 1, 1 2 3. Returns the position in the draft order of a pick. */
export function pickerIndex(members: number, pickNo: number): number {
  const round = Math.floor(pickNo / members);
  const at = pickNo % members;
  return round % 2 === 0 ? at : members - 1 - at;
}

export function pickerAt<T>(order: readonly T[], pickNo: number): T {
  const who = order[pickerIndex(order.length, pickNo)];
  if (who === undefined) throw new RangeError("empty draft order");
  return who;
}

export function nextAvailable(
  pool: readonly PoolPlayer[],
  taken: ReadonlySet<string>,
): string | undefined {
  return pool.find((p) => !taken.has(p.player))?.player;
}

/** Orders the season's players for the draft: ranked names first, in rank order, then the rest. */
export function buildPool(config: PickemConfig, ranking: readonly string[]): PoolPlayer[] {
  const rank = new Map(ranking.map((name, i) => [name, i]));
  return config.entrants
    .map((e, i) => ({
      player: e.player,
      race: e.race,
      at: rank.get(e.player) ?? ranking.length + i,
    }))
    .sort((a, b) => a.at - b.at)
    .map(({ player, race }) => ({ player, race }));
}

/** One point per game won. */
export function playerPoints(gameWins: GameWins, player: string): number {
  return gameWins[player] ?? 0;
}

export type TeamPlayer = { player: string; points: number; out: boolean };

export type TeamStanding = {
  rank: number;
  userId: string;
  displayName: string;
  points: number;
  players: TeamPlayer[];
  /** True for the winning team once the season is decided. */
  champion: boolean;
};

/**
 * Teams ranked by points; teams level on points share a rank. The results only say who is
 * out and whether the season is over.
 */
export function teamStandings(
  config: PickemConfig,
  results: Selection,
  gameWins: GameWins,
  members: readonly { userId: string; displayName: string }[],
  picks: readonly { userId: string; player: string }[],
): TeamStanding[] {
  const out = eliminations(config, results);
  const done = isComplete(config, results);
  const teams = members.map((m) => {
    const players = picks
      .filter((p) => p.userId === m.userId)
      .map((p) => ({
        player: p.player,
        points: playerPoints(gameWins, p.player),
        out: out.has(p.player),
      }));
    return { ...m, players, points: players.reduce((s, p) => s + p.points, 0) };
  });
  teams.sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName));
  let rank = 0;
  let last: number | undefined;
  return teams.map((team, i) => {
    if (team.points !== last) rank = i + 1;
    last = team.points;
    return { ...team, rank, champion: done && rank === 1 && team.players.length > 0 };
  });
}
