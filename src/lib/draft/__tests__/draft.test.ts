import { describe, expect, it } from "vitest";

import { makeGameWins, makePickemConfig, makeResults } from "@/test/factories/pickem";

import {
  buildPool,
  nextAvailable,
  pickerIndex,
  playerPoints,
  teamSizeOptions,
  teamStandings,
} from "../draft";

const config = makePickemConfig();
const results = makeResults();
const wins = makeGameWins();

describe("snake order", () => {
  it("reverses every other round", () => {
    expect(Array.from({ length: 9 }, (_, pick) => pickerIndex(3, pick))).toEqual([
      0, 1, 2, 2, 1, 0, 0, 1, 2,
    ]);
  });
});

describe("team sizes", () => {
  it("offers every size the player pool can fill", () => {
    expect(teamSizeOptions(28, 4)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(teamSizeOptions(28, 12)).toEqual([1, 2]);
    expect(teamSizeOptions(28, 0)).toEqual([]);
  });
});

describe("the player pool", () => {
  it("puts ranked players first, in rank order, then the rest as listed", () => {
    const pool = buildPool(config, ["soma", "Flash"]).map((p) => p.player);
    expect(pool.slice(0, 4)).toEqual(["soma", "Flash", "Rain", "Light"]);
    expect(pool).toHaveLength(12);
  });

  it("takes the best player still free when a clock runs out", () => {
    const pool = buildPool(config, ["soma", "Flash"]);
    expect(nextAvailable(pool, new Set(["soma"]))).toBe("Flash");
    expect(nextAvailable(pool, new Set(pool.map((p) => p.player)))).toBeUndefined();
  });
});

describe("scoring", () => {
  it("pays one point per game a player has won", () => {
    expect(playerPoints(wins, "soma")).toBe(9);
    expect(playerPoints(wins, "Mini")).toBe(0);
  });

  const members = [
    { userId: "a", displayName: "Ann" },
    { userId: "b", displayName: "Bo" },
    { userId: "c", displayName: "Cy" },
  ];
  const picks = [
    { userId: "a", player: "Flash" },
    { userId: "b", player: "soma" },
    { userId: "c", player: "Light" },
    { userId: "c", player: "Rain" },
    { userId: "b", player: "Mini" },
    { userId: "a", player: "Soulkey" },
  ];

  it("ranks teams by their players' points and crowns the winner at the end", () => {
    const table = teamStandings(config, results, wins, members, picks);
    expect(table.map((t) => [t.displayName, t.rank, t.points, t.champion])).toEqual([
      ["Ann", 1, 12, true],
      ["Bo", 2, 9, false],
      ["Cy", 3, 3, false],
    ]);
    expect(table[2]?.players).toEqual([
      { player: "Light", points: 1, out: true },
      { player: "Rain", points: 2, out: true },
    ]);
  });

  it("crowns nobody while the season is still being played", () => {
    const table = teamStandings(config, { groups: ["Flash", "Rain"] }, wins, members, picks);
    expect(table.some((t) => t.champion)).toBe(false);
    expect(teamStandings(config, {}, {}, members, picks).map((t) => t.rank)).toEqual([1, 1, 1]);
  });
});
