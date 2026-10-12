// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import Screp from "screp-js";
import { describe, expect, it } from "vitest";

import { estimateBuildOrder, formatFrame, summarizeBuildOrder } from "../buildOrder";
import type { ReplayRace } from "../buildOrder";

/**
 * Two real ladder replays, kept as fixtures so a refresh of public/replays/ cannot break the
 * tests. The openings are standard ones, which is what makes them a check on the estimate.
 */
async function opening(file: string, player: string, steps: number): Promise<string[]> {
  const bytes = readFileSync(path.join(__dirname, "fixtures", file));
  const replay = await Screp.parseBuffer(new Uint8Array(bytes), { cmds: true });
  const found = replay.Header.Players.find((p) => p.Name === player);
  if (!found) throw new Error(`${player} is not in ${file}`);
  const all = estimateBuildOrder(replay.Commands.Cmds, found.ID, found.Race.Name as ReplayRace);
  return summarizeBuildOrder(all)
    .slice(0, steps)
    .map(
      (s) => `${formatFrame(s.frame)} ${s.supply} ${s.name}${s.cancelled ? " (cancelled)" : ""}`,
    );
}

describe("build orders from real replays", () => {
  it("reads a Terran one Factory expand", async () => {
    expect(await opening("terran-vs-terran.rep", "DemonHunterho", 7)).toEqual([
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
    expect(await opening("zerg-vs-terran.rep", "Rush`net", 6)).toEqual([
      "0:56 9 Overlord",
      "1:07 9 Extractor (cancelled)",
      "1:48 12 Hatchery",
      "2:11 11 Extractor",
      "2:14 10 Spawning Pool",
      "3:06 14 Lair",
    ]);
  });
});
