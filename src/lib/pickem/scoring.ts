/** Scores a bracket against the results so far. Pure; the same code runs for every reader. */
import { chosen, groupOf } from "./bracket";
import type { PickemConfig, PickemStatus, Selection } from "./types";

export type PickStatus = "correct" | "wrong" | "pending";

export type RoundScore = {
  key: string;
  label: string;
  correct: number;
  /** Wrong picks, plus picks left blank once the round is decided. */
  wrong: number;
  pending: number;
  points: number;
};

export type EntryScore = {
  points: number;
  /** Points if every pending pick comes in. */
  possible: number;
  correct: number;
  wrong: number;
  pending: number;
  /** correct / (correct + wrong), or null before anything is decided. */
  accuracy: number | null;
  rounds: RoundScore[];
  /** Status of each pick, by round key then player. */
  statuses: Record<string, Record<string, PickStatus>>;
};

function isRoundDecided(config: PickemConfig, results: Selection, roundIdx: number): boolean {
  const round = config.rounds[roundIdx];
  return round !== undefined && chosen(results, round).length >= round.advance;
}

export function isComplete(config: PickemConfig, results: Selection): boolean {
  return isRoundDecided(config, results, config.rounds.length - 1);
}

export function statusOf(config: PickemConfig, results: Selection, locked: boolean): PickemStatus {
  if (!locked) return "open";
  return isComplete(config, results) ? "complete" : "live";
}

export function championOf(config: PickemConfig, selection: Selection): string | null {
  const last = config.rounds.at(-1);
  return last ? (chosen(selection, last)[0] ?? null) : null;
}

/**
 * The round each eliminated player went out in. A player is out of a round once that round is
 * decided without them; in a group round, as soon as their own group is decided without them.
 */
export function eliminations(config: PickemConfig, results: Selection): Map<string, number> {
  const out = new Map<string, number>();
  for (const entrant of config.entrants) {
    for (let i = entrant.entersAt; i < config.rounds.length; i += 1) {
      const round = config.rounds[i];
      if (!round) break;
      const through = chosen(results, round);
      if (through.includes(entrant.player)) continue;
      const groupFull =
        round.perGroup !== null &&
        through.filter((p) => groupOf(config, p) === entrant.group).length >= round.perGroup;
      if (groupFull || isRoundDecided(config, results, i)) out.set(entrant.player, i);
      break;
    }
  }
  return out;
}

export function scoreEntry(config: PickemConfig, results: Selection, picks: Selection): EntryScore {
  const out = eliminations(config, results);
  const statuses: Record<string, Record<string, PickStatus>> = {};
  const rounds: RoundScore[] = config.rounds.map((round, i) => {
    const through = new Set(chosen(results, round));
    const picked = chosen(picks, round);
    const byPlayer: Record<string, PickStatus> = {};
    let correct = 0;
    let wrong = 0;
    let pending = 0;
    for (const player of picked) {
      const outAt = out.get(player);
      const status: PickStatus = through.has(player)
        ? "correct"
        : outAt !== undefined && outAt <= i
          ? "wrong"
          : "pending";
      byPlayer[player] = status;
      if (status === "correct") correct += 1;
      else if (status === "wrong") wrong += 1;
      else pending += 1;
    }
    if (isRoundDecided(config, results, i)) {
      wrong += pending + (round.advance - picked.length);
      pending = 0;
      for (const player of picked) if (byPlayer[player] === "pending") byPlayer[player] = "wrong";
    }
    statuses[round.key] = byPlayer;
    return {
      key: round.key,
      label: round.label,
      correct,
      wrong,
      pending,
      points: correct * round.points,
    };
  });

  const sum = (pick: (r: RoundScore) => number): number => rounds.reduce((s, r) => s + pick(r), 0);
  const points = sum((r) => r.points);
  const correct = sum((r) => r.correct);
  const wrong = sum((r) => r.wrong);
  const possible =
    points + config.rounds.reduce((s, round, i) => s + (rounds[i]?.pending ?? 0) * round.points, 0);
  return {
    points,
    possible,
    correct,
    wrong,
    pending: sum((r) => r.pending),
    accuracy: correct + wrong === 0 ? null : correct / (correct + wrong),
    rounds,
    statuses,
  };
}

type Rankable = { displayName: string; score: EntryScore };

/**
 * Orders brackets by points, then accuracy, then name. Brackets level on points share a rank
 * (1, 1, 3).
 */
export function rankEntries<T extends Rankable>(entries: readonly T[]): (T & { rank: number })[] {
  const sorted = [...entries].sort(
    (a, b) =>
      b.score.points - a.score.points ||
      (b.score.accuracy ?? -1) - (a.score.accuracy ?? -1) ||
      a.displayName.localeCompare(b.displayName),
  );
  let rank = 0;
  let last: number | undefined;
  return sorted.map((entry, i) => {
    if (entry.score.points !== last) rank = i + 1;
    last = entry.score.points;
    return { ...entry, rank };
  });
}
