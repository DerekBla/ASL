import { ReplayReadError, readBuildOrders } from "@/lib/replay/readReplay";
import type { ReplayBuilds } from "@/lib/replay/readReplay";

/** Replays run from about 20 KB to a few hundred. Anything far larger is not one. */
export const MAX_REPLAY_BYTES = 5 * 1024 * 1024;

/**
 * Reads a replay file in the browser. Nothing is uploaded: the parser runs on the page. It is
 * large (about 370 KB compressed), so it is loaded only when a file is picked.
 */
export async function parseReplayFile(file: File): Promise<ReplayBuilds> {
  if (!file.name.toLowerCase().endsWith(".rep")) {
    throw new ReplayReadError("That is not a replay. Pick a file that ends in .rep.");
  }
  if (file.size > MAX_REPLAY_BYTES) {
    throw new ReplayReadError("That file is too large to be a replay.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { default: Screp } = await import("screp-js");
  let replay;
  try {
    replay = await Screp.parseBuffer(bytes, { cmds: true });
  } catch {
    throw new ReplayReadError("This file could not be read as a StarCraft replay.");
  }
  return readBuildOrders(replay);
}
