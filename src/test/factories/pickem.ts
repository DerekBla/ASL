import type { PickemConfig, PickemEntrant, Selection } from "@/lib/pickem/types";
import type { SavePickemInput } from "@/lib/services/pickem";
import type { UserId } from "@/lib/types/ids";

const entrant = (player: string, group: string | null): PickemEntrant => ({
  player,
  race: null,
  group,
  entersAt: group === null ? 1 : 0,
});

/**
 * A small season in the ASL's shape: two groups of four send two each to the quarterfinals,
 * where four seeds join. 11 picks, 28 points.
 */
export function makePickemConfig(overrides: Partial<PickemConfig> = {}): PickemConfig {
  return {
    entrants: [
      ...["Flash", "Rain", "Light", "Mini"].map((p) => entrant(p, "A")),
      ...["Soulkey", "SnOw", "Rush", "Best"].map((p) => entrant(p, "B")),
      ...["soma", "Queen", "Bisu", "Jaedong"].map((p) => entrant(p, null)),
    ],
    rounds: [
      { key: "groups", label: "Group stage", advance: 4, points: 1, perGroup: 2 },
      { key: "ro8", label: "Quarterfinals", advance: 4, points: 2, perGroup: null },
      { key: "ro4", label: "Semifinals", advance: 2, points: 4, perGroup: null },
      { key: "final", label: "Final", advance: 1, points: 8, perGroup: null },
    ],
    ...overrides,
  };
}

/** How the test season really went: soma beats Flash in the final. */
export function makeResults(overrides: Selection = {}): Selection {
  return {
    groups: ["Flash", "Rain", "Soulkey", "Rush"],
    ro8: ["Flash", "Soulkey", "soma", "Bisu"],
    ro4: ["Flash", "soma"],
    final: ["soma"],
    ...overrides,
  };
}

/** Games won in the test season, by player. */
export function makeGameWins(): Record<string, number> {
  return { soma: 9, Flash: 8, Soulkey: 4, Bisu: 3, Rain: 2, Rush: 2, Light: 1 };
}

/** A pick'em that locks in a week unless overridden. */
export function makePickemInput(
  adminId: UserId,
  overrides: Partial<SavePickemInput> = {},
): SavePickemInput {
  return {
    season: 23,
    title: "ASL Season 23 pick'em",
    locksAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    config: makePickemConfig(),
    adminId,
    ...overrides,
  };
}
