import { describe, expect, it } from "vitest";

import {
  findPlayer,
  getElo,
  getEloForPlayer,
  getLatestCompleteSeason,
  getManifest,
  getPlacementsForPlayer,
  getPlacementsForSeason,
  getPlayer,
  getPlayers,
  getPlayerStats,
  getRaceStats,
  getSeason,
  getSeasons,
  getSeriesForSeason,
  getStatsForPlayer,
} from "../index";

describe("stats loader", () => {
  it("returns seasons in order and finds one by number", () => {
    const seasons = getSeasons();
    expect(seasons.map((s) => s.season)).toEqual(seasons.map((_, i) => i + 1));
    expect(getSeason(5)).toMatchObject({ winner: "Rain", runnerUp: "SnOw", finalScore: "3-1" });
    expect(getSeason(999)).toBeUndefined();
  });

  it("knows the latest completed season", () => {
    const latest = getLatestCompleteSeason();
    expect(latest?.season).toBe(getManifest().seasons.complete);
    expect(latest?.winner).toBeTruthy();
  });

  it("finds players by canonical name, and by alias ignoring case", () => {
    expect(getPlayer("tulbo")).toMatchObject({ race: "P" });
    expect(getPlayer("huro")).toBeUndefined();
    expect(findPlayer("huro")?.player).toBe("tulbo");
    expect(findPlayer("BEST")?.player).toBe("Best");
    expect(findPlayer("nobody-by-this-name")).toBeUndefined();
  });

  it("gives every player a race and a unique name", () => {
    const players = getPlayers();
    expect(players.filter((p) => p.race === null)).toEqual([]);
    expect(new Set(players.map((p) => p.player.toLowerCase())).size).toBe(players.length);
  });

  it("returns placements for one player, oldest first", () => {
    const seasons = getPlacementsForPlayer("Flash").map((p) => p.season);
    expect(seasons).toEqual([...seasons].sort((a, b) => a - b));
    expect(seasons.length).toBe(getStatsForPlayer("Flash")?.seasons);
    expect(getPlacementsForPlayer("nobody")).toEqual([]);
  });

  it("returns placements for one season, best finish first", () => {
    const rows = getPlacementsForSeason(21);
    const ranks = rows.map((r) => r.placement.best);
    expect(rows).toHaveLength(28);
    expect(rows[0]).toMatchObject({ player: "soma", placement: { label: "1st" } });
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("has ELO in rank order, matching career stats", () => {
    const elo = getElo();
    expect(elo.map((r) => r.rank)).toEqual(elo.map((_, i) => i + 1));
    expect(getPlayerStats().map((r) => r.player)).toEqual(elo.map((r) => r.player));
    expect(getEloForPlayer("Flash")?.currentElo).toBe(getStatsForPlayer("Flash")?.currentElo);
  });

  it("has race stats and series that agree with the seasons", () => {
    const titles = getRaceStats().overall.reduce((sum, r) => sum + r.championships, 0);
    expect(titles).toBe(getManifest().seasons.complete);
    const finals = getSeriesForSeason(21).filter((s) => s.round === "final");
    expect(finals).toEqual([expect.objectContaining({ winner: "soma", loser: "Flash" })]);
  });
});
