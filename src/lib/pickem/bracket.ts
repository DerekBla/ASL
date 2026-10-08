/** Bracket rules: who can be picked where, and whether a set of picks or results is legal. */
import type { PickemConfig, PickemRound, Selection } from "./types";

function roundAt(config: PickemConfig, roundIdx: number): PickemRound {
  const round = config.rounds[roundIdx];
  if (!round) throw new RangeError(`no round ${roundIdx}`);
  return round;
}

export function chosen(selection: Selection, round: PickemRound): readonly string[] {
  return selection[round.key] ?? [];
}

/** Players who can be chosen in a round: those advanced out of the round before, plus seeds. */
export function poolFor(config: PickemConfig, selection: Selection, roundIdx: number): string[] {
  const previous = roundIdx === 0 ? [] : chosen(selection, roundAt(config, roundIdx - 1));
  const carried = new Set(previous);
  return config.entrants
    .filter((e) => e.entersAt === roundIdx || carried.has(e.player))
    .map((e) => e.player);
}

export function groupOf(config: PickemConfig, player: string): string | null {
  return config.entrants.find((e) => e.player === player)?.group ?? null;
}

/** Group names of the first round, in the order the entrants list them. */
export function groupsOf(config: PickemConfig): string[] {
  const groups: string[] = [];
  for (const e of config.entrants) {
    if (e.entersAt === 0 && e.group !== null && !groups.includes(e.group)) groups.push(e.group);
  }
  return groups;
}

export function totalPicks(config: PickemConfig): number {
  return config.rounds.reduce((sum, r) => sum + r.advance, 0);
}

export function picksMade(config: PickemConfig, selection: Selection): number {
  return config.rounds.reduce((sum, r) => sum + chosen(selection, r).length, 0);
}

export function maxPoints(config: PickemConfig): number {
  return config.rounds.reduce((sum, r) => sum + r.advance * r.points, 0);
}

function groupCount(
  config: PickemConfig,
  players: readonly string[],
  group: string | null,
): number {
  return players.filter((p) => groupOf(config, p) === group).length;
}

/** Whether one more player (from this player's group) still fits in the round. */
export function hasRoom(
  config: PickemConfig,
  selection: Selection,
  roundIdx: number,
  player: string,
): boolean {
  const round = roundAt(config, roundIdx);
  const picked = chosen(selection, round);
  if (picked.length >= round.advance) return false;
  if (round.perGroup === null) return true;
  return groupCount(config, picked, groupOf(config, player)) < round.perGroup;
}

/** Why a pick'em setup is not usable, or null when it is. */
export function checkConfig(config: PickemConfig): string | null {
  const names = config.entrants.map((e) => e.player.toLowerCase());
  if (new Set(names).size !== names.length) return "Every player can be listed only once.";
  const keys = config.rounds.map((r) => r.key);
  if (new Set(keys).size !== keys.length) return "Round keys must be different.";
  if (config.entrants.some((e) => e.entersAt >= config.rounds.length))
    return "A player is seeded into a round that does not exist.";

  let carried = 0;
  for (const [i, round] of config.rounds.entries()) {
    const entering = config.entrants.filter((e) => e.entersAt === i);
    const pool = carried + entering.length;
    if (round.advance >= pool)
      return `${round.label}: ${round.advance} advance but only ${pool} play in it.`;
    const perGroup = round.perGroup;
    if (perGroup !== null) {
      if (i !== 0) return "Only the first round can be picked group by group.";
      if (entering.some((e) => e.group === null))
        return `${round.label}: every player needs a group.`;
      const groups = groupsOf(config);
      if (groups.length * perGroup !== round.advance)
        return `${round.label}: ${groups.length} groups of ${perGroup} do not make ${round.advance}.`;
      const short = groups.find((g) => entering.filter((e) => e.group === g).length <= perGroup);
      if (short !== undefined) return `Group ${short} has too few players.`;
    }
    carried = round.advance;
  }
  if (config.rounds.at(-1)?.advance !== 1) return "The last round must advance one champion.";
  return null;
}

/**
 * Why a bracket's picks (or the admin's results) are not legal, or null when they are.
 * Unfinished selections are legal: a round may hold fewer players than advance from it.
 */
export function checkSelection(config: PickemConfig, selection: Selection): string | null {
  const keys = new Set(config.rounds.map((r) => r.key));
  if (Object.keys(selection).some((k) => !keys.has(k))) return "Unknown round.";
  for (const [i, round] of config.rounds.entries()) {
    const picked = chosen(selection, round);
    if (new Set(picked).size !== picked.length) return `${round.label}: a player is listed twice.`;
    if (picked.length > round.advance) return `${round.label}: only ${round.advance} can advance.`;
    const pool = new Set(poolFor(config, selection, i));
    const stray = picked.find((p) => !pool.has(p));
    if (stray !== undefined)
      return i === 0
        ? `${round.label}: ${stray} is not in this round.`
        : `${round.label}: ${stray} did not advance from the round before.`;
    const perGroup = round.perGroup;
    if (perGroup !== null) {
      const over = groupsOf(config).find((g) => groupCount(config, picked, g) > perGroup);
      if (over !== undefined)
        return `${round.label}: only ${perGroup} can advance from group ${over}.`;
    }
  }
  return null;
}

/** Keeps each round in entrant order and drops empty rounds, so equal brackets store equally. */
export function normalizeSelection(config: PickemConfig, selection: Selection): Selection {
  const out: Selection = {};
  for (const round of config.rounds) {
    const picked = new Set(chosen(selection, round));
    const ordered = config.entrants.map((e) => e.player).filter((p) => picked.has(p));
    if (ordered.length > 0) out[round.key] = ordered;
  }
  return out;
}

/**
 * Picks or unpicks a player in a round. Unpicking also removes the player from every later
 * round. Picking does nothing when the round (or the player's group) is full, except in a
 * one player round, where the new pick replaces the old one.
 */
export function togglePick(
  config: PickemConfig,
  selection: Selection,
  roundIdx: number,
  player: string,
): Selection {
  const round = roundAt(config, roundIdx);
  const picked = chosen(selection, round);
  const next: Selection = { ...selection };
  if (picked.includes(player)) {
    for (const later of config.rounds.slice(roundIdx)) {
      next[later.key] = chosen(selection, later).filter((p) => p !== player);
    }
    return normalizeSelection(config, next);
  }
  if (!poolFor(config, selection, roundIdx).includes(player)) return selection;
  if (round.advance === 1) {
    next[round.key] = [player];
  } else if (hasRoom(config, selection, roundIdx, player)) {
    next[round.key] = [...picked, player];
  } else {
    return selection;
  }
  return normalizeSelection(config, next);
}
