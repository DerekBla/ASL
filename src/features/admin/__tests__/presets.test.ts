import { describe, expect, it } from "vitest";

import { getEloForPlayer } from "@/lib/services/stats";

import { eloPrior, s22FinalPreset } from "../presets";

describe("eloPrior", () => {
  it("sums to 1 and favours the higher-rated player", () => {
    const [a, b] = eloPrior("Flash", "Rush");
    expect(a + b).toBeCloseTo(1, 12);
    const flash = getEloForPlayer("Flash")?.currentElo ?? 0;
    const rush = getEloForPlayer("Rush")?.currentElo ?? 0;
    expect(a > b).toBe(flash > rush);
  });

  it("falls back to even odds for an unknown player", () => {
    expect(eloPrior("Flash", "Nobody")).toEqual([0.5, 0.5]);
  });
});

describe("s22FinalPreset", () => {
  it("is the ASL S22 final between Rush and Soulkey, closing at 15:00 KST on October 17", () => {
    const preset = s22FinalPreset();
    expect(preset.outcomes.map((o) => o.player)).toEqual(["Rush", "Soulkey"]);
    expect(preset.closesAt).toBe("2026-10-17T06:00:00.000Z");
    expect(preset.b).toBe(10);
    expect(preset.season).toBe(22);
    expect(preset.prior).toEqual(eloPrior("Rush", "Soulkey"));
  });
});

describe("eloWinProbability", () => {
  it("is 50% for equal ratings and about 76% for a 200-point edge", async () => {
    const { eloWinProbability } = await import("@/lib/market/priors");
    expect(eloWinProbability(1800, 1800)).toBe(0.5);
    expect(eloWinProbability(2000, 1800)).toBeCloseTo(0.7597, 4);
  });
});
