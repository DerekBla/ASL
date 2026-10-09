import { describe, expect, it } from "vitest";

import { eloWinProbability, seriesWinProbability } from "@/lib/market/priors";

import {
  getBestOf,
  getElo,
  getHeadToHead,
  getManifest,
  getMapBySlug,
  getMaps,
  getMapsForPlayer,
  getPlayerBySlug,
  getPlayers,
  getRecords,
  getSeasonInProgress,
  getSeasons,
  getSeriesForPlayer,
  getStatsForPlayer,
  getWinChance,
  mapSlug,
  playerSlug,
  searchPlayers,
} from "../index";

describe("seriesWinProbability", () => {
  it("is the game itself for one game, and stretches an edge over a longer series", () => {
    expect(seriesWinProbability(0.6, 1)).toBeCloseTo(0.6, 12);
    // Best of 3 at 60%: win both, or split the first two and win the third.
    expect(seriesWinProbability(0.6, 3)).toBeCloseTo(0.36 + 2 * 0.36 * 0.4, 12);
    expect(seriesWinProbability(0.6, 7)).toBeCloseTo(0.710208, 6);
    expect(seriesWinProbability(0.5, 7)).toBeCloseTo(0.5, 12);
    expect(seriesWinProbability(0.3, 5) + seriesWinProbability(0.7, 5)).toBeCloseTo(1, 12);
  });
});

describe("getWinChance", () => {
  it("comes from the two current ratings and mirrors when the players swap", () => {
    const [first, second] = getElo();
    if (!first || !second) throw new Error("expected two rated players");
    const chance = getWinChance(first.player, second.player);
    const scale = getManifest().elo.probabilityScale;
    expect(chance?.game).toBeCloseTo(
      eloWinProbability(first.currentElo, second.currentElo, scale),
      12,
    );
    expect(chance?.game).toBeGreaterThanOrEqual(0.5);
    // Scaled to the games played: closer to even than the plain formula.
    expect(chance?.game).toBeLessThanOrEqual(
      eloWinProbability(first.currentElo, second.currentElo),
    );
    const back = getWinChance(second.player, first.player);
    expect((chance?.game ?? 0) + (back?.game ?? 0)).toBeCloseTo(1, 12);
  });

  it("is undefined for an unknown player or the same player twice", () => {
    expect(getWinChance("Flash", "Nobody")).toBeUndefined();
    expect(getWinChance("Flash", "flash")).toBeUndefined();
  });
});

describe("maps", () => {
  it("give every map a unique slug that finds it again", () => {
    for (const m of getMaps()) expect(getMapBySlug(mapSlug(m.map))?.map).toBe(m.map);
    expect(getMapBySlug("not-a-map")).toBeUndefined();
  });

  it("list a player's maps with the same games the map lists for them", () => {
    const mine = getMapsForPlayer("Flash");
    expect(mine.length).toBeGreaterThan(10);
    for (const row of mine) {
      const onMap = getMapBySlug(mapSlug(row.map))?.players.find((p) => p.player === "Flash");
      expect(onMap).toMatchObject({ wins: row.wins, losses: row.losses });
    }
    // Named games cannot outnumber all the games the player has played.
    const stats = getStatsForPlayer("Flash");
    const named = mine.reduce((n, r) => n + r.wins + r.losses, 0);
    expect(named).toBeLessThanOrEqual((stats?.gamesWon ?? 0) + (stats?.gamesLost ?? 0));
  });
});

describe("records", () => {
  it("has a title run for every finished season", () => {
    const finished = getSeasons().filter((s) => s.status === "complete");
    expect(getRecords().titleRuns.map((r) => r.player)).toEqual(finished.map((s) => s.winner));
  });
});

describe("getBestOf and getSeasonInProgress", () => {
  it("reads a round's length from the last one played", () => {
    expect(getBestOf("final")).toBe(7);
    expect([5, 7]).toContain(getBestOf("quarterfinal"));
  });

  it("is the newest season only while it has no champion", () => {
    const newest = getSeasons().at(-1);
    expect(getSeasonInProgress()?.season).toBe(
      newest?.status === "in_progress" ? newest.season : undefined,
    );
  });
});

describe("searchPlayers", () => {
  it("gives the one player for an exact name or an old spelling, whatever the case", () => {
    expect(searchPlayers("flash").map((p) => p.player)).toEqual(["Flash"]);
    expect(searchPlayers(" ZerO ").map((p) => p.player)).toEqual(["Queen"]);
  });

  it("lists partial matches, names that start with the text first", () => {
    const found = searchPlayers("so").map((p) => p.player);
    expect(found).toContain("Soulkey");
    expect(found).toContain("soma");
    // Everyone found has the text in their name or in an old spelling of it.
    for (const p of searchPlayers("so")) {
      expect([p.player, ...p.aliases].some((n) => n.toLowerCase().includes("so"))).toBe(true);
    }
    // A name that only contains the text comes after the names that start with it.
    const inside = searchPlayers("ou").map((p) => p.player);
    expect(inside).toContain("Soulkey");
    const s = searchPlayers("s").map((p) => p.player);
    expect(s.indexOf("soma")).toBeLessThan(s.indexOf("Flash"));
  });

  it("finds nobody for empty text or nonsense", () => {
    expect(searchPlayers("  ")).toEqual([]);
    expect(searchPlayers("zzzzqq")).toEqual([]);
  });
});

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
