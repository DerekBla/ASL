import type { PickemRound } from "./types";

/**
 * The ASL format since S5: 24 players in six groups, four seeds joining in the round of 16.
 * Every round is worth 16 points in total except the first (12), so later rounds matter most.
 */
export const ASL_ROUNDS: readonly PickemRound[] = [
  { key: "ro24", label: "Round of 24", advance: 12, points: 1, perGroup: 2 },
  { key: "ro16", label: "Round of 16", advance: 8, points: 2, perGroup: null },
  { key: "ro8", label: "Quarterfinals", advance: 4, points: 4, perGroup: null },
  { key: "ro4", label: "Semifinals", advance: 2, points: 8, perGroup: null },
  { key: "final", label: "Final", advance: 1, points: 16, perGroup: null },
];

/** Group name an admin gives a player who is seeded past the first round. */
export const SEED_GROUP = "seed";
