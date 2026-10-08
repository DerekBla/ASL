/**
 * Pick'em achievements. They are worked out from a bracket and the results every time they are
 * shown, never stored, so a corrected result corrects them too.
 */
import { chosen, totalPicks } from "./bracket";
import { championOf, isComplete } from "./scoring";
import type { EntryScore } from "./scoring";
import type { PickemConfig, Selection } from "./types";

export type Achievement = { key: string; name: string; description: string };

export type Standing = {
  rank: number;
  entries: number;
  /** Share of all brackets that picked the same champion as this one. */
  championShare: number | null;
};

export const SHARP_EYE_ACCURACY = 0.75;
export const DARK_HORSE_SHARE = 0.2;
export const DARK_HORSE_MIN_ENTRIES = 5;

export function achievementsFor(
  config: PickemConfig,
  results: Selection,
  picks: Selection,
  score: EntryScore,
  standing: Standing,
): Achievement[] {
  const earned: Achievement[] = [];
  const champion = championOf(config, results);
  const calledChampion = champion !== null && championOf(config, picks) === champion;

  if (calledChampion) {
    earned.push({
      key: "called_champion",
      name: "Called the champion",
      description: `Picked ${champion} to win it all.`,
    });
    if (
      standing.entries >= DARK_HORSE_MIN_ENTRIES &&
      standing.championShare !== null &&
      standing.championShare < DARK_HORSE_SHARE
    ) {
      earned.push({
        key: "dark_horse",
        name: "Dark horse",
        description: "Called a champion that fewer than one in five brackets picked.",
      });
    }
  }

  // The last round is the champion pick, which has its own achievement above.
  for (const [i, round] of config.rounds.slice(0, -1).entries()) {
    if (chosen(results, round).length < round.advance) continue;
    if (score.rounds[i]?.correct === round.advance) {
      earned.push({
        key: `perfect_${round.key}`,
        name: `Perfect ${round.label}`,
        description: `Got all ${round.advance} picks right in the ${round.label}.`,
      });
    }
  }

  if (!isComplete(config, results)) return earned;

  if (score.correct === totalPicks(config)) {
    earned.push({
      key: "perfect_bracket",
      name: "Perfect bracket",
      description: "Every single pick was right.",
    });
  }
  if (score.accuracy !== null && score.accuracy >= SHARP_EYE_ACCURACY) {
    earned.push({
      key: "sharp_eye",
      name: "Sharp eye",
      description: "At least three in four picks were right.",
    });
  }
  if (score.points > 0 && standing.rank === 1) {
    earned.push({
      key: "season_winner",
      name: "Season winner",
      description: "Finished first in the season's pick'em.",
    });
  } else if (score.points > 0 && standing.rank <= 3) {
    earned.push({
      key: "podium",
      name: "Podium finish",
      description: "Finished in the top three of the season's pick'em.",
    });
  }
  return earned;
}
