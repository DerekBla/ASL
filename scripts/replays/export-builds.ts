/**
 * Build orders from the saved replays (offline).
 *
 *   pnpm replays:export
 *
 * Reads data/source/cwal/replays.json and the .rep files under public/replays/, and writes
 * data/generated/builds.json. The same input always gives the same file.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import Screp from "screp-js";

import { estimateBuildOrder, summarizeBuildOrder } from "../../src/lib/replay/buildOrder";
import type { BuildStep, ReplayRace } from "../../src/lib/replay/buildOrder";

import type { SavedReplay } from "./fetch-cwal";

/** Build orders stop here: ten minutes on Fastest. Later supply is too far off to be useful. */
const MAX_FRAME = 14286;

const RACE_CODES: Record<string, "T" | "Z" | "P"> = { Terran: "T", Zerg: "Z", Protoss: "P" };

type PlayerOut = {
  name: string;
  pro: string | null;
  race: "T" | "Z" | "P";
  subject: boolean;
  apm: number;
  /** Start position as a clock hour, 1 to 12. */
  start: number;
  steps: BuildStep[];
};

async function main(): Promise<void> {
  const root = process.cwd();
  const index = JSON.parse(
    await readFile(path.join(root, "data", "source", "cwal", "replays.json"), "utf8"),
  ) as { source: string; minDurationSeconds: number; replays: SavedReplay[] };

  const replays = [];
  for (const saved of index.replays) {
    const bytes = await readFile(path.join(root, "public", saved.file));
    const replay = await Screp.parseBuffer(new Uint8Array(bytes), { cmds: true });
    if (replay.Header.Speed.Name !== "Fastest") {
      throw new Error(`${saved.id}: speed is ${replay.Header.Speed.Name}, times assume Fastest`);
    }
    const humans = replay.Header.Players.filter((p) => p.Type.Name === "Human");
    if (humans.length !== 2) throw new Error(`${saved.id}: expected 2 players, got ${humans.length}`);
    const subject = humans.find((p) => p.Name.toLowerCase() === saved.toon.toLowerCase());
    if (!subject) throw new Error(`${saved.id}: ${saved.toon} is not in the replay`);

    const players: PlayerOut[] = humans.map((player) => {
      const race = RACE_CODES[player.Race.Name];
      if (!race) throw new Error(`${saved.id}: unknown race ${player.Race.Name}`);
      const desc = replay.Computed.PlayerDescs.find((d) => d.PlayerID === player.ID);
      const all = estimateBuildOrder(
        replay.Commands.Cmds,
        player.ID,
        player.Race.Name as ReplayRace,
        MAX_FRAME,
      );
      const isSubject = player.ID === subject.ID;
      return {
        name: player.Name,
        pro: isSubject ? saved.pro : saved.opponentPro,
        race,
        subject: isSubject,
        apm: desc?.APM ?? 0,
        start: desc?.StartDirection ?? 0,
        steps: summarizeBuildOrder(all),
      };
    });
    // The pro first, then the opponent.
    players.sort((a, b) => Number(b.subject) - Number(a.subject));

    replays.push({
      id: saved.id,
      pro: saved.pro,
      proSlug: saved.proSlug,
      playedAt: saved.playedAt,
      durationSeconds: saved.durationSeconds,
      map: replay.Header.Map,
      result: saved.result,
      mmr: saved.mmr,
      opponentMmr: saved.opponentMmr,
      file: saved.file,
      sourceUrl: `https://cwal.gg/viewer?match=${encodeURIComponent(saved.matchId)}`,
      players,
    });
  }

  replays.sort((a, b) => b.playedAt.localeCompare(a.playedAt) || a.id.localeCompare(b.id));
  const body = {
    schemaVersion: 1,
    source: { name: "cwal.gg", url: index.source },
    minDurationSeconds: index.minDurationSeconds,
    maxFrame: MAX_FRAME,
    replays,
  };
  await writeFile(
    path.join(root, "data", "generated", "builds.json"),
    `${JSON.stringify(body, null, 2)}\n`,
  );
  console.warn(`wrote ${replays.length} replays to data/generated/builds.json`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
