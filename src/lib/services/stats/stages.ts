/**
 * Shapes one season's series for display: the playoffs as a bracket and each group as a
 * standings table with its matches. Pure. Everything is derived from the exported series, in
 * the order the export lists them (the order they were played).
 */
import type { Race } from "@/lib/types/race";

import type { Series } from "./schemas";

export type BracketSide = {
  player: string;
  race: Race | null;
  /** Games won in the series; null when the export has no score. */
  score: number | null;
  won: boolean;
};

export type BracketMatch = { top: BracketSide; bottom: BracketSide };

export type BracketRound = {
  key: "quarterfinal" | "semifinal" | "final";
  label: string;
  matches: BracketMatch[];
};

export type Bracket = {
  /** Earliest round first. Rounds with no series yet are left out. */
  rounds: BracketRound[];
  thirdPlace: BracketMatch | undefined;
};

const BRACKET_ROUNDS = [
  { key: "quarterfinal", label: "Quarterfinals" },
  { key: "semifinal", label: "Semifinals" },
  { key: "final", label: "Final" },
] as const;

function games(score: string | null, side: 0 | 1): number | null {
  const value = Number(score?.split("-")[side]);
  return score !== null && Number.isInteger(value) ? value : null;
}

/** Scores are exported winner first: "3-1". */
function toMatch(s: Series, topIsWinner: boolean): BracketMatch {
  const winner = { player: s.winner, race: s.winnerRace, score: games(s.score, 0), won: true };
  const loser = { player: s.loser, race: s.loserRace, score: games(s.score, 1), won: false };
  return topIsWinner ? { top: winner, bottom: loser } : { top: loser, bottom: winner };
}

const played = (s: Series, player: string): boolean => s.winner === player || s.loser === player;

/**
 * Orders a round so that the two series feeding the same later series sit next to each other,
 * in the order that later series lists its players. Series that feed nothing keep their place
 * at the end.
 */
function feeders(round: readonly Series[], later: readonly BracketMatch[]): Series[] {
  const ordered: Series[] = [];
  for (const match of later) {
    for (const side of [match.top, match.bottom]) {
      const feeder = round.find((s) => s.winner === side.player);
      if (feeder && !ordered.includes(feeder)) ordered.push(feeder);
    }
  }
  return [...ordered, ...round.filter((s) => !ordered.includes(s))];
}

export function buildBracket(series: readonly Series[]): Bracket {
  const playoffs = series.filter((s) => s.stage === "playoffs");
  const of = (round: string): Series[] => playoffs.filter((s) => s.round === round);

  const semis = of("semifinal");
  const final = of("final").map((s) => {
    // The finalist from the upper semifinal goes on top.
    const upper = semis[0];
    return toMatch(s, upper ? played(upper, s.winner) : true);
  });
  const semiMatches = semis.map((s) => toMatch(s, true));
  const quarterMatches = feeders(of("quarterfinal"), semiMatches).map((s) => toMatch(s, true));

  const byKey = { quarterfinal: quarterMatches, semifinal: semiMatches, final };
  const third = of("third_place")[0];
  return {
    rounds: BRACKET_ROUNDS.map((r) => ({ ...r, matches: byKey[r.key] })).filter(
      (r) => r.matches.length > 0,
    ),
    thirdPlace: third ? toMatch(third, true) : undefined,
  };
}

export type GroupRow = {
  player: string;
  race: Race | null;
  wins: number;
  losses: number;
  /** Null while the next stage has no series, so nobody is known to be through. */
  advanced: boolean | null;
};

export type GroupMatch = {
  /** "Opening match", "Winners match" and so on; null when the group was not a dual tournament. */
  label: string | null;
  series: Series;
};

export type StageGroup = {
  name: string;
  /** Advancing players first, then by record. */
  rows: GroupRow[];
  matches: GroupMatch[];
  /** Extra series played to split a tie. They do not count in the records above. */
  tiebreaker: Series[];
};

export type GroupStage = { key: "ro24" | "ro16"; label: string; groups: StageGroup[] };

const GROUP_STAGES = [
  { key: "ro24", label: "Round of 24", next: "ro16" },
  { key: "ro16", label: "Round of 16", next: "playoffs" },
] as const;

const TIEBREAKER = " Tiebreaker";
const DUAL_LABELS = [
  "Opening match",
  "Opening match",
  "Winners match",
  "Losers match",
  "Decider match",
];

const pair = (s: Series): string => [s.winner, s.loser].sort().join("\n");
const same = (s: Series, a: string, b: string): boolean => pair(s) === [a, b].sort().join("\n");

/** Five series in the dual tournament shape: two openers, winners, losers, decider. */
function isDualTournament(matches: readonly Series[]): boolean {
  const [a, b, c, d, e] = matches;
  if (!a || !b || !c || !d || !e || matches.length !== 5) return false;
  return same(c, a.winner, b.winner) && same(d, a.loser, b.loser) && same(e, c.loser, d.winner);
}

function buildGroup(
  name: string,
  matches: readonly Series[],
  tiebreaker: readonly Series[],
  through: ReadonlySet<string> | undefined,
): StageGroup {
  const rows = new Map<string, GroupRow>();
  const row = (player: string, race: Race | null): GroupRow => {
    const found = rows.get(player);
    if (found) return found;
    const made = {
      player,
      race,
      wins: 0,
      losses: 0,
      advanced: through ? through.has(player) : null,
    };
    rows.set(player, made);
    return made;
  };
  for (const s of matches) {
    row(s.winner, s.winnerRace).wins += 1;
    row(s.loser, s.loserRace).losses += 1;
  }
  const dual = isDualTournament(matches);
  return {
    name,
    rows: [...rows.values()].sort(
      (a, b) =>
        Number(b.advanced ?? false) - Number(a.advanced ?? false) ||
        b.wins - a.wins ||
        a.losses - b.losses ||
        a.player.localeCompare(b.player),
    ),
    matches: matches.map((series, i) => ({
      label: dual ? (DUAL_LABELS[i] ?? null) : null,
      series,
    })),
    tiebreaker: [...tiebreaker],
  };
}

export function buildGroupStages(series: readonly Series[]): GroupStage[] {
  return GROUP_STAGES.flatMap((stage) => {
    const inStage = series.filter((s) => s.stage === stage.key);
    if (inStage.length === 0) return [];
    const next = series.filter((s) => s.stage === stage.next);
    const through = next.length > 0 ? new Set(next.flatMap((s) => [s.winner, s.loser])) : undefined;
    const names = [...new Set(inStage.map((s) => s.round).filter((r) => !r.endsWith(TIEBREAKER)))];
    return [
      {
        key: stage.key,
        label: stage.label,
        groups: names.map((name) =>
          buildGroup(
            name,
            inStage.filter((s) => s.round === name),
            inStage.filter((s) => s.round === name + TIEBREAKER),
            through,
          ),
        ),
      },
    ];
  });
}
