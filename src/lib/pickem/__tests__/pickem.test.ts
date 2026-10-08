import { describe, expect, it } from "vitest";

import { makePickemConfig, makeResults } from "@/test/factories/pickem";

import { achievementsFor } from "../achievements";
import type { Standing } from "../achievements";
import { ASL_ROUNDS } from "../asl-format";
import {
  checkConfig,
  checkSelection,
  maxPoints,
  normalizeSelection,
  poolFor,
  togglePick,
  totalPicks,
} from "../bracket";
import { eliminations, rankEntries, scoreEntry, statusOf } from "../scoring";
import type { PickemConfig, Selection } from "../types";

const config = makePickemConfig();
const results = makeResults();

function aslConfig(): PickemConfig {
  const groups = ["A", "B", "C", "D", "E", "F"];
  return {
    entrants: [
      ...groups.flatMap((group) =>
        [1, 2, 3, 4].map((n) => ({ player: `${group}${n}`, race: null, group, entersAt: 0 })),
      ),
      ...[1, 2, 3, 4].map((n) => ({ player: `Seed${n}`, race: null, group: null, entersAt: 1 })),
    ],
    rounds: [...ASL_ROUNDS],
  };
}

describe("checkConfig", () => {
  it("accepts the standard ASL format: 27 picks worth 76 points", () => {
    const asl = aslConfig();
    expect(checkConfig(asl)).toBeNull();
    expect(totalPicks(asl)).toBe(27);
    expect(maxPoints(asl)).toBe(76);
  });

  it("rejects a player listed twice, ignoring case", () => {
    const twice = makePickemConfig();
    twice.entrants[1] = { player: "flash", race: null, group: "A", entersAt: 0 };
    expect(checkConfig(twice)).toMatch(/only once/);
  });

  it("rejects a round nobody is knocked out of", () => {
    const flat = makePickemConfig();
    flat.entrants = flat.entrants.filter((e) => e.entersAt === 0);
    expect(checkConfig(flat)).toMatch(/Quarterfinals: 4 advance but only 4 play/);
  });

  it("rejects groups that do not add up to the round", () => {
    const off = makePickemConfig();
    off.rounds[0] = { key: "groups", label: "Group stage", advance: 4, points: 1, perGroup: 1 };
    expect(checkConfig(off)).toMatch(/2 groups of 1 do not make 4/);
  });

  it("rejects a last round without a single champion", () => {
    const two = makePickemConfig();
    two.rounds.pop();
    expect(checkConfig(two)).toMatch(/one champion/);
  });
});

describe("picking", () => {
  it("offers seeds from the round they join", () => {
    expect(poolFor(config, {}, 0)).toHaveLength(8);
    expect(poolFor(config, { groups: ["Flash"] }, 1)).toEqual([
      "Flash",
      "soma",
      "Queen",
      "Bisu",
      "Jaedong",
    ]);
  });

  it("stops at two per group", () => {
    let picks: Selection = {};
    for (const player of ["Flash", "Rain", "Light"]) picks = togglePick(config, picks, 0, player);
    expect(picks.groups).toEqual(["Flash", "Rain"]);
  });

  it("unpicking a player removes them from every later round", () => {
    const picks: Selection = {
      groups: ["Flash", "Rain"],
      ro8: ["Flash", "soma"],
      ro4: ["Flash", "soma"],
      final: ["Flash"],
    };
    expect(togglePick(config, picks, 0, "Flash")).toEqual({
      groups: ["Rain"],
      ro8: ["soma"],
      ro4: ["soma"],
    });
  });

  it("replaces the champion instead of refusing a second one", () => {
    const picks: Selection = { ...results, final: ["Flash"] };
    expect(togglePick(config, picks, 3, "soma").final).toEqual(["soma"]);
  });

  it("ignores a player who is not in the round's pool", () => {
    expect(togglePick(config, {}, 1, "Flash")).toEqual({});
  });
});

describe("checkSelection", () => {
  it("accepts a full bracket and an unfinished one", () => {
    expect(checkSelection(config, results)).toBeNull();
    expect(checkSelection(config, { groups: ["Flash"] })).toBeNull();
  });

  it.each([
    [{ groups: ["Flash", "Rain", "Light"] }, /only 2 can advance from group A/],
    [{ groups: ["Flash"], ro8: ["Rain"] }, /Rain did not advance/],
    [{ groups: ["soma"] }, /soma is not in this round/],
    [{ groups: ["Flash", "Flash"] }, /listed twice/],
    [{ ...makeResults(), final: ["soma", "Flash"] }, /only 1 can advance/],
    [{ nope: ["Flash"] }, /Unknown round/],
  ] satisfies [Selection, RegExp][])("rejects %j", (selection, message) => {
    expect(checkSelection(config, selection)).toMatch(message);
  });

  it("stores equal brackets equally", () => {
    expect(normalizeSelection(config, { groups: ["Rush", "Flash"], ro8: [] })).toEqual({
      groups: ["Flash", "Rush"],
    });
  });
});

describe("scoreEntry", () => {
  it("scores a perfect bracket at full points", () => {
    const score = scoreEntry(config, results, results);
    expect(score.points).toBe(maxPoints(config));
    expect(score).toMatchObject({ correct: 11, wrong: 0, pending: 0, accuracy: 1 });
  });

  it("gives later rounds more weight", () => {
    const picks: Selection = {
      groups: ["Flash", "Light", "Soulkey", "Best"], // 2 right
      ro8: ["Flash", "Light", "soma", "Queen"], // 2 right
      ro4: ["Flash", "Queen"], // 1 right
      final: ["Flash"], // wrong
    };
    const score = scoreEntry(config, results, picks);
    expect(score.rounds.map((r) => r.points)).toEqual([2, 4, 4, 0]);
    expect(score).toMatchObject({ points: 10, correct: 5, wrong: 6 });
    expect(score.accuracy).toBeCloseTo(5 / 11);
  });

  it("marks a pick wrong in every round once the player is out", () => {
    const picks: Selection = {
      groups: ["Light"],
      ro8: ["Light"],
      ro4: ["Light"],
      final: ["Light"],
    };
    // Only group A is decided: Light is out, nothing else is known.
    const score = scoreEntry(config, { groups: ["Flash", "Rain"] }, picks);
    expect(score.statuses.final?.Light).toBe("wrong");
    expect(score).toMatchObject({ correct: 0, wrong: 4, pending: 0, possible: 0 });
  });

  it("keeps picks pending, and still winnable, while their round is being played", () => {
    const picks: Selection = { groups: ["Flash", "Soulkey"], ro8: ["Flash"], final: ["Flash"] };
    const score = scoreEntry(config, { groups: ["Flash", "Rain"] }, picks);
    expect(score.statuses.groups).toEqual({ Flash: "correct", Soulkey: "pending" });
    expect(score).toMatchObject({ points: 1, correct: 1, wrong: 0, pending: 3, possible: 12 });
  });

  it("counts picks left blank as misses once the round is decided", () => {
    const score = scoreEntry(config, results, { groups: ["Flash"] });
    expect(score).toMatchObject({ correct: 1, wrong: 10 });
    expect(score.accuracy).toBeCloseTo(1 / 11);
  });

  it("knows seeds cannot go out before the round they join", () => {
    const out = eliminations(config, { groups: ["Flash", "Rain", "Soulkey", "Rush"] });
    expect(out.get("Light")).toBe(0);
    expect(out.has("soma")).toBe(false);
  });
});

describe("standings", () => {
  it("ranks by points, shares a rank on a tie, and breaks the order by accuracy", () => {
    const entry = (displayName: string, picks: Selection) => ({
      displayName,
      score: scoreEntry(config, results, picks),
    });
    const ranked = rankEntries([
      entry("low", { groups: ["Flash"] }),
      entry("top", results),
      entry("also low", { groups: ["Rain"] }),
    ]);
    expect(ranked.map((r) => [r.displayName, r.rank])).toEqual([
      ["top", 1],
      ["also low", 2],
      ["low", 2],
    ]);
  });

  it("is open until the lock, then live until the final is decided", () => {
    expect(statusOf(config, {}, false)).toBe("open");
    expect(statusOf(config, { groups: ["Flash"] }, true)).toBe("live");
    expect(statusOf(config, results, true)).toBe("complete");
  });
});

describe("achievementsFor", () => {
  const standing: Standing = { rank: 1, entries: 10, championShare: 0.5 };
  const keys = (picks: Selection, so: Selection = results, at: Standing = standing): string[] =>
    achievementsFor(config, so, picks, scoreEntry(config, so, picks), at).map((a) => a.key);

  it("gives a perfect bracket everything but the dark horse", () => {
    expect(keys(results)).toEqual([
      "called_champion",
      "perfect_groups",
      "perfect_ro8",
      "perfect_ro4",
      "perfect_bracket",
      "sharp_eye",
      "season_winner",
    ]);
  });

  it("awards the dark horse for a champion few brackets picked", () => {
    expect(keys(results, results, { ...standing, championShare: 0.1 })).toContain("dark_horse");
    expect(keys(results, results, { rank: 1, entries: 3, championShare: 0.1 })).not.toContain(
      "dark_horse",
    );
  });

  it("awards a perfect round as soon as that round is decided", () => {
    expect(keys(results, { groups: results.groups ?? [] })).toEqual(["perfect_groups"]);
  });

  it("holds the season awards until the final is decided", () => {
    const beforeFinal = { ...results, final: [] };
    expect(keys(results, beforeFinal)).not.toContain("season_winner");
  });

  it("gives second and third a podium finish, and nothing to an empty bracket", () => {
    expect(keys(results, results, { ...standing, rank: 3 })).toContain("podium");
    expect(keys({}, results, standing)).toEqual([]);
  });
});
