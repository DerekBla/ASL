// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import Screp from "screp-js";
import { describe, expect, it } from "vitest";

import { formatFrame } from "../buildOrder";
import { ReplayReadError, readBuildOrders } from "../readReplay";
import type { ParsedReplay, ReplayBuilds } from "../readReplay";

/**
 * Two real ladder replays, kept as fixtures so a refresh of public/replays/ cannot break the
 * tests. The openings are standard ones, which is what makes them a check on the estimate.
 */
async function parse(file: string): Promise<ParsedReplay> {
  const bytes = readFileSync(path.join(__dirname, "fixtures", file));
  return Screp.parseBuffer(new Uint8Array(bytes), { cmds: true });
}

function opening(game: ReplayBuilds, player: string, steps: number): string[] {
  const found = game.players.find((p) => p.name === player);
  if (!found) throw new Error(`${player} is not in the replay`);
  return found.steps
    .slice(0, steps)
    .map(
      (s) => `${formatFrame(s.frame)} ${s.supply} ${s.name}${s.cancelled ? " (cancelled)" : ""}`,
    );
}

describe("build orders from real replays", () => {
  it("reads a Terran one Factory expand", async () => {
    const game = readBuildOrders(await parse("terran-vs-terran.rep"));
    expect(game).toMatchObject({ map: "Backrooms 1.1", speed: "Fastest" });
    expect(game.players.map((p) => [p.name, p.race, p.won])).toEqual([
      ["DemonHunterho", "T", true],
      ["llllIIIllllIIIl", "T", false],
    ]);
    expect(opening(game, "DemonHunterho", 7)).toEqual([
      "0:53 9 Supply Depot",
      "1:26 11 Barracks",
      "1:39 12 Refinery",
      "2:17 15 Supply Depot",
      "2:29 16 Factory",
      "2:31 16 Marine",
      "3:12 21 Command Center",
    ]);
  });

  it("reads a Zerg twelve Hatchery with an extractor trick", async () => {
    const game = readBuildOrders(await parse("zerg-vs-terran.rep"));
    expect(opening(game, "Rush`net", 6)).toEqual([
      "0:56 9 Overlord",
      "1:07 9 Extractor (cancelled)",
      "1:48 12 Hatchery",
      "2:11 11 Extractor",
      "2:14 10 Spawning Pool",
      "3:06 14 Lair",
    ]);
  });

  it("stops every build order at the frame limit", async () => {
    const game = readBuildOrders(await parse("terran-vs-terran.rep"), 3000);
    for (const player of game.players) {
      expect(Math.max(...player.steps.map((s) => s.frame))).toBeLessThanOrEqual(3000);
    }
  });

  it("refuses a replay with no commands or no human players", async () => {
    const parsed = await parse("terran-vs-terran.rep");
    expect(() => readBuildOrders({ ...parsed, Commands: null })).toThrow(ReplayReadError);
    const noHumans = { ...parsed, Header: { ...parsed.Header, Players: [] } };
    expect(() => readBuildOrders(noHumans)).toThrow(ReplayReadError);
  });
});
