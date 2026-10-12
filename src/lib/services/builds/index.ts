/**
 * Builds loader: the only code that reads data/generated/builds.json.
 *
 * Server only. The JSON is bundled at build time, validated once, and cached for the life of
 * the process. `pnpm replays:export` writes the file from the replays in public/replays/.
 */
import "server-only";

import builds from "../../../../data/generated/builds.json";
import { buildsFileSchema } from "./schemas";
import type { BuildReplay, BuildsFile } from "./schemas";

export type { BuildPlayer, BuildReplay, BuildStep, BuildsFile } from "./schemas";

let cached: BuildsFile | undefined;

function load(): BuildsFile {
  cached ??= buildsFileSchema.parse(builds);
  return cached;
}

/** Where the replays came from, and the rules they were picked and cut by. */
export function getBuildsInfo(): Omit<BuildsFile, "replays"> {
  const { source, minDurationSeconds, maxFrame, schemaVersion } = load();
  return { source, minDurationSeconds, maxFrame, schemaVersion };
}

/** Every stored replay, newest first. */
export function getBuildReplays(): readonly BuildReplay[] {
  return load().replays;
}

export function getBuildReplay(id: string): BuildReplay | undefined {
  return load().replays.find((replay) => replay.id === id);
}

/** The pros with stored replays, in name order, each with their games newest first. */
export function getBuildReplaysByPro(): readonly {
  pro: string;
  proSlug: string;
  replays: BuildReplay[];
}[] {
  const groups = new Map<string, { pro: string; proSlug: string; replays: BuildReplay[] }>();
  for (const replay of load().replays) {
    const group = groups.get(replay.pro) ?? {
      pro: replay.pro,
      proSlug: replay.proSlug,
      replays: [],
    };
    group.replays.push(replay);
    groups.set(replay.pro, group);
  }
  return [...groups.values()].sort((a, b) => a.pro.localeCompare(b.pro));
}
