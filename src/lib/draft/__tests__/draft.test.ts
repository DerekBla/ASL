import { describe, expect, it } from "vitest";

import { ASL_ROUNDS } from "@/lib/pickem/asl-format";

import { makeGameWins, makePickemConfig, makeResults } from "@/test/factories/pickem";

import {
  bonusPoints,
  buildPool,
  nextAvailable,
  pickerIndex,
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
  it("pays a bonus point for each late round a player gets through", () => {
    // soma is seeded into the last 8, then reaches the last 4, the final, and wins it.
    expect(bonusPoints(config, results, "soma")).toBe(3);
    expect(bonusPoints(config, results, "Bisu")).toBe(1);
    expect(bonusPoints(config, results, "Mini")).toBe(0);
    expect(bonusPoints(config, {}, "soma")).toBe(0);
  });

  it("does not pay a bonus for getting out of the round of 24", () => {
    const asl = { ...config, rounds: [...ASL_ROUNDS] };
    const run = ["Flash"];
    const through = { ro24: run, ro16: run, ro8: run, ro4: run, final: run };
    expect(bonusPoints(asl, { ro24: run }, "Flash")).toBe(0);
    expect(bonusPoints(asl, through, "Flash")).toBe(4);
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
      ["Ann", 1, 17, true], // Flash 8 + 3, Soulkey 4 + 2
      ["Bo", 2, 12, false], // soma 9 + 3, Mini 0
      ["Cy", 3, 4, false],
    ]);
    expect(table[2]?.players).toEqual([
      { player: "Light", wins: 1, bonus: 0, points: 1, out: true },
      { player: "Rain", wins: 2, bonus: 1, points: 3, out: true },
    ]);
  });

  it("crowns nobody while the season is still being played", () => {
    const table = teamStandings(config, { groups: ["Flash", "Rain"] }, wins, members, picks);
    expect(table.some((t) => t.champion)).toBe(false);
    expect(teamStandings(config, {}, {}, members, picks).map((t) => t.rank)).toEqual([1, 1, 1]);
  });
});
