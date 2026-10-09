import type { Series } from "@/lib/services/stats";

export const STAGE_LABEL: Record<Series["stage"], string> = {
  ro24: "Round of 24",
  ro16: "Round of 16",
  playoffs: "Playoffs",
};

export const PLAYOFF_ROUND_LABEL: Record<string, string> = {
  final: "Final",
  third_place: "Third place match",
  semifinal: "Semifinal",
  quarterfinal: "Quarterfinal",
};

/** Where a series was played: "Final", or "Round of 24, Group A". */
export function roundLabel(s: Pick<Series, "stage" | "round">): string {
  return s.stage === "playoffs"
    ? (PLAYOFF_ROUND_LABEL[s.round] ?? s.round)
    : `${STAGE_LABEL[s.stage]}, ${s.round}`;
}

/**
 * One player's games won and lost in a series: from the score, else counted from the games
 * the page lists (group series carry no score). Null when the page has neither.
 */
export function gamesFor(s: Series, player: string): { won: number; lost: number } | null {
  const [a, b] = (s.score ?? "").split("-").map(Number);
  if (a !== undefined && b !== undefined && Number.isInteger(a) && Number.isInteger(b)) {
    return s.winner === player ? { won: a, lost: b } : { won: b, lost: a };
  }
  if (s.games.length === 0) return null;
  const won = s.games.filter((g) => g.winner === player).length;
  return { won, lost: s.games.length - won };
}
