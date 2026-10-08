// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { countGameWins } from "../parse-games";

const season21 = readFileSync(join(process.cwd(), "data/source/liquipedia/s21.wiki"), "utf-8");

describe("countGameWins", () => {
  it("counts each game to its winner and skips games not played", () => {
    const page = `
{{Matchlist|id=X|title=Group A Matches
|M1={{Match|bestof=1
	|opponent1={{1Opponent|Sharp}}
	|opponent2={{1Opponent|Scan|flag=kr}}
	|map1={{Map|winner=1|map=Octagon}}
}}
}}
{{Match
	|opponent1={{1Opponent|Flash}}
	|opponent2={{1Opponent|Sharp}}
	|map1={{Map|map=Pole Star|winner=2}}
	|map2={{Map|winner=1|map=Octagon}}
	|map3={{Map|winner=|map=Match Point}}
}}
{{Match
	|opponent1={{1Opponent|}}
	|opponent2={{1Opponent|}}
	|map1={{Map|winner=|map=}}
}}`;
    expect(countGameWins(page)).toEqual({
      wins: { Sharp: 2, Flash: 1 },
      games: 3,
      series: 2,
    });
  });

  it("reads a real season page: S21, where soma beat Flash 4–3 in the final", () => {
    const { wins, games, series } = countGameWins(season21);
    expect(series).toBe(57);
    expect(Object.values(wins).reduce((a, b) => a + b, 0)).toBe(games);
    expect(games).toBe(100);
    // Names are as the page writes them: JD is Jaedong.
    expect(wins).toMatchObject({ Flash: 16, soma: 14, JD: 7 });
  });
});
