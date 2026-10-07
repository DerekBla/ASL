/** Race letter codes as stored in the stats data. Display names come from RACE_NAMES. */
export const RACES = ["T", "Z", "P"] as const;

export type Race = (typeof RACES)[number];

export const RACE_NAMES: Record<Race, string> = {
  T: "Terran",
  Z: "Zerg",
  P: "Protoss",
};
