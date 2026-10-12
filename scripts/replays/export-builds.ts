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

import { BUILD_ORDER_MAX_FRAME, readBuildOrders } from "../../src/lib/replay/readReplay";

import type { SavedReplay } from "./fetch-cwal";

async function main(): Promise<void> {
  const root = process.cwd();
  const index = JSON.parse(
    await readFile(path.join(root, "data", "source", "cwal", "replays.json"), "utf8"),
  ) as { source: string; minDurationSeconds: number; replays: SavedReplay[] };

  const replays = [];
  for (const saved of index.replays) {
    const bytes = await readFile(path.join(root, "public", saved.file));
    const parsed = await Screp.parseBuffer(new Uint8Array(bytes), { cmds: true });
    const game = readBuildOrders(parsed);
    if (game.speed !== "Fastest") {
      throw new Error(`${saved.id}: speed is ${game.speed}, times assume Fastest`);
    }
    if (game.players.length !== 2) {
      throw new Error(`${saved.id}: expected 2 players, got ${game.players.length}`);
    }
    const subject = game.players.find((p) => p.name.toLowerCase() === saved.toon.toLowerCase());
    if (!subject) throw new Error(`${saved.id}: ${saved.toon} is not in the replay`);

    const players = game.players
      .map((player) => {
        const isSubject = player.id === subject.id;
        return {
          name: player.name,
          pro: isSubject ? saved.pro : saved.opponentPro,
          race: player.race,
          subject: isSubject,
          apm: player.apm,
          start: player.start,
          steps: player.steps,
        };
      })
      // The pro first, then the opponent.
      .sort((a, b) => Number(b.subject) - Number(a.subject));

    replays.push({
      id: saved.id,
      pro: saved.pro,
      proSlug: saved.proSlug,
      playedAt: saved.playedAt,
      durationSeconds: saved.durationSeconds,
      map: game.map,
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
    maxFrame: BUILD_ORDER_MAX_FRAME,
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
