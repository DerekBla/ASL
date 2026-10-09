import { describe, expect, it } from "vitest";

import { buildBracket, buildGroupStages, getSeriesForSeason } from "@/lib/services/stats";
import type { Series } from "@/lib/services/stats";

function series(
  stage: Series["stage"],
  round: string,
  winner: string,
  loser: string,
  score: string | null = null,
): Series {
  return {
    season: 99,
    stage,
    round,
    winner,
    loser,
    winnerRace: "T",
    loserRace: "Z",
    score,
    games: [],
    vod: null,
  };
}

describe("buildBracket", () => {
  it("puts the two quarterfinals that feed a semifinal next to each other", () => {
    const bracket = buildBracket(getSeriesForSeason(5));
    expect(bracket.rounds.map((r) => r.label)).toEqual(["Quarterfinals", "Semifinals", "Final"]);
    const [quarters, semis, final] = bracket.rounds.map((r) =>
      r.matches.map((m) => [m.top.player, m.bottom.player]),
    );
    expect(semis).toEqual([
      ["Rain", "herO"],
      ["SnOw", "Mini"],
    ]);
    expect(quarters?.map((m) => m[0])).toEqual(["Rain", "herO", "SnOw", "Mini"]);
    expect(final).toEqual([["Rain", "SnOw"]]);
  });

  it("splits the score between the two players and marks the winner", () => {
    const final = buildBracket(getSeriesForSeason(5)).rounds.at(-1)?.matches[0];
    expect(final?.top).toMatchObject({ player: "Rain", score: 3, won: true });
    expect(final?.bottom).toMatchObject({ player: "SnOw", score: 1, won: false });
  });

  it("keeps the finalist from the upper semifinal on top even when he lost", () => {
    // S1: Sharp won the first semifinal and lost the final to Shuttle.
    const final = buildBracket(getSeriesForSeason(1)).rounds.at(-1)?.matches[0];
    expect(final?.top).toMatchObject({ player: "Sharp", won: false });
    expect(final?.bottom).toMatchObject({ player: "Shuttle", won: true });
  });

  it("carries the maps and the cast of each series", () => {
    const quarter = buildBracket(getSeriesForSeason(21)).rounds[0]?.matches[0];
    expect(quarter?.top.player).toBe("soma");
    expect(quarter?.games).toEqual([
      { map: "Match Point", winner: "soma" },
      { map: "KnockOut", winner: "soma" },
      { map: "Jane Doe", winner: "soma" },
    ]);
    expect(quarter?.vod).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=/);
    // Older bracket pages list no games.
    expect(buildBracket(getSeriesForSeason(5)).rounds[0]?.matches[0]?.games).toEqual([]);
  });

  it("has a third place match only in the seasons that played one", () => {
    expect(buildBracket(getSeriesForSeason(5)).thirdPlace?.top.player).toBe("herO");
    expect(buildBracket(getSeriesForSeason(21)).thirdPlace).toBeUndefined();
  });

  it("adds a series that is set but not played, with nobody marked as the winner", () => {
    const played = getSeriesForSeason(21).filter((s) => s.round !== "final");
    const upcoming = [
      {
        round: "final" as const,
        players: [
          { player: "Flash", race: "T" as const },
          { player: "soma", race: "Z" as const },
        ],
      },
    ];
    const final = buildBracket(played, upcoming).rounds.at(-1);
    expect(final?.key).toBe("final");
    // soma won the upper semifinal, so he goes on top whatever order the page lists them in.
    expect(final?.matches[0]).toMatchObject({
      top: { player: "soma", score: null, won: false },
      bottom: { player: "Flash", score: null, won: false },
      upcoming: true,
      vod: null,
    });
    expect(buildBracket(played).rounds.map((r) => r.key)).toEqual(["quarterfinal", "semifinal"]);
  });

  it("leaves out rounds that have not been played", () => {
    const bracket = buildBracket([
      series("playoffs", "quarterfinal", "A", "B", "3-0"),
      series("playoffs", "quarterfinal", "C", "D"),
    ]);
    expect(bracket.rounds.map((r) => r.key)).toEqual(["quarterfinal"]);
    expect(bracket.rounds[0]?.matches[1]?.top.score).toBeNull();
    expect(buildBracket([]).rounds).toEqual([]);
  });

  it("feeds every semifinal of every season from the two quarterfinals beside it", () => {
    for (let season = 1; season <= 21; season += 1) {
      const [quarters, semis] = buildBracket(getSeriesForSeason(season)).rounds;
      expect(quarters?.matches).toHaveLength(4);
      semis?.matches.forEach((semi, i) => {
        const feeders = quarters?.matches.slice(i * 2, i * 2 + 2).map((m) => m.top.player);
        expect(feeders).toEqual([semi.top.player, semi.bottom.player]);
      });
    }
  });
});

describe("buildGroupStages", () => {
  it("ranks a dual tournament group and names its five matches", () => {
    const stages = buildGroupStages(getSeriesForSeason(2));
    expect(stages.map((s) => s.label)).toEqual(["Round of 24", "Round of 16"]);
    const group = stages[0]?.groups[0];
    expect(group?.name).toBe("Group A");
    expect(group?.rows.map((r) => [r.player, r.wins, r.losses, r.advanced])).toEqual([
      ["Bisu", 2, 0, true],
      ["GuemChi", 2, 1, true],
      ["Ample", 1, 2, false],
      ["Larva", 0, 2, false],
    ]);
    expect(group?.matches.map((m) => m.label)).toEqual([
      "Opening match",
      "Opening match",
      "Winners match",
      "Losers match",
      "Decider match",
    ]);
  });

  it("gives a group the cast of its first series", () => {
    const group = buildGroupStages(getSeriesForSeason(3))[0]?.groups[0];
    expect(group?.vod).toBe("https://www.youtube.com/watch?v=6TTGeGWY6hQ&t=2040s");
    expect(group?.matches[0]?.series.games).toEqual([{ map: "Camelot", winner: "Shuttle" }]);
    const bare = buildGroupStages([series("ro24", "Group A", "A", "B")])[0]?.groups[0];
    expect(bare?.vod).toBeNull();
  });

  it("keeps a tiebreaker with its group and out of the records", () => {
    const stages = buildGroupStages(getSeriesForSeason(1));
    expect(stages.map((s) => s.key)).toEqual(["ro16"]);
    const groups = stages[0]?.groups ?? [];
    expect(groups.map((g) => g.name)).toEqual(["Group A", "Group B", "Group C", "Group D"]);
    const b = groups[1];
    expect(b?.matches).toHaveLength(6);
    expect(b?.matches[0]?.label).toBeNull();
    expect(b?.tiebreaker).toHaveLength(6);
    expect(b?.rows.reduce((sum, r) => sum + r.wins, 0)).toBe(6);
    expect(b?.rows.filter((r) => r.advanced)).toHaveLength(2);
  });

  it("sends two players through from every group of every season, listed first", () => {
    for (let season = 1; season <= 21; season += 1) {
      for (const stage of buildGroupStages(getSeriesForSeason(season))) {
        for (const group of stage.groups) {
          expect(group.rows.filter((r) => r.advanced)).toHaveLength(2);
          expect(group.rows.slice(0, 2).every((r) => r.advanced)).toBe(true);
        }
      }
    }
  });

  it("does not say who advanced while the next stage has no series", () => {
    const [stage] = buildGroupStages([
      series("ro24", "Group A", "A", "B"),
      series("ro24", "Group A", "C", "D"),
    ]);
    expect(stage?.groups[0]?.rows.map((r) => r.advanced)).toEqual([null, null, null, null]);
    expect(stage?.groups[0]?.matches.map((m) => m.label)).toEqual([null, null]);
  });
});
