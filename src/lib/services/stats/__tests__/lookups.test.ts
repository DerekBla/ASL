import { describe, expect, it } from "vitest";

import {
  getHeadToHead,
  getPlayerBySlug,
  getPlayers,
  getSeriesForPlayer,
  playerSlug,
} from "../index";

describe("player slugs", () => {
  it("give every player a unique slug that finds them again", () => {
    for (const p of getPlayers()) {
      expect(getPlayerBySlug(playerSlug(p.player))?.player).toBe(p.player);
    }
  });

  it("finds nobody for an unknown slug", () => {
    expect(getPlayerBySlug("not-a-player")).toBeUndefined();
  });
});

describe("getSeriesForPlayer", () => {
  it("returns only series the player was in, oldest season first", () => {
    const series = getSeriesForPlayer("Flash");
    expect(series.length).toBeGreaterThan(0);
    for (const s of series) expect([s.winner, s.loser]).toContain("Flash");
    const seasons = series.map((s) => s.season);
    expect(seasons).toEqual([...seasons].sort((a, b) => a - b));
  });
});

describe("getHeadToHead", () => {
  it("collects every series between two players, with totals that add up", () => {
    const h2h = getHeadToHead("Flash", "soma");
    expect(h2h).toBeDefined();
    if (!h2h) return;
    expect(h2h.winsA + h2h.winsB).toBe(h2h.series.length);
    for (const s of h2h.series) {
      expect([s.winner, s.loser].sort()).toEqual(["Flash", "soma"].sort());
    }
    expect(h2h.series).toContainEqual(
      expect.objectContaining({ season: 21, round: "final", winner: "soma", loser: "Flash" }),
    );
  });

  it("lists seasons both entered with each placement, and who finished ahead", () => {
    const h2h = getHeadToHead("Flash", "soma");
    if (!h2h) throw new Error("expected a result");
    const s21 = h2h.sharedSeasons.find((x) => x.season === 21);
    expect(s21?.a.placement.label).toBe("2nd");
    expect(s21?.b.placement.label).toBe("1st");
    expect(h2h.finishedAboveA + h2h.finishedAboveB).toBeLessThanOrEqual(h2h.sharedSeasons.length);
  });

  it("accepts aliases and any case", () => {
    expect(getHeadToHead("snow", "HERO")?.a.player).toBe("SnOw");
    expect(getHeadToHead("snow", "HERO")?.b.player).toBe("herO");
  });

  it("returns nothing for an unknown name or the same player twice", () => {
    expect(getHeadToHead("Flash", "nobody")).toBeUndefined();
    expect(getHeadToHead("Best", "BeSt")).toBeUndefined();
  });
});
