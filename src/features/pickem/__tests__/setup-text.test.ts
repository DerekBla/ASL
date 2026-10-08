import { describe, expect, it } from "vitest";

import { ASL_ROUNDS } from "@/lib/pickem/asl-format";

import { makePickemConfig } from "@/test/factories/pickem";

import { entrantsToText, parseEntrants, parseRounds, roundsToText } from "../setup-text";

describe("setup text", () => {
  it("reads players with a group, an optional race, and seeds", () => {
    expect(parseEntrants("A | Flash | t\n\n  A|Rain  \nseed | soma | Z")).toEqual({
      data: [
        { player: "Flash", race: "T", group: "A", entersAt: 0 },
        { player: "Rain", race: null, group: "A", entersAt: 0 },
        { player: "soma", race: "Z", group: null, entersAt: 1 },
      ],
    });
  });

  it("explains a line it cannot read", () => {
    expect(parseEntrants("Flash")).toMatchObject({
      error: expect.stringMatching(/Group \| Player/),
    });
    expect(parseEntrants("A | Flash | X")).toEqual({ error: "Flash: race must be T, Z or P." });
    expect(parseRounds("ro24 | Round of 24 | many | 1")).toMatchObject({
      error: expect.stringMatching(/key \| Label/),
    });
  });

  it("writes a setup out and reads the same setup back", () => {
    const config = makePickemConfig();
    expect(parseEntrants(entrantsToText(config.entrants))).toEqual({ data: config.entrants });
    expect(parseRounds(roundsToText(config.rounds))).toEqual({ data: config.rounds });
    expect(parseRounds(roundsToText(ASL_ROUNDS))).toEqual({ data: ASL_ROUNDS });
  });
});
