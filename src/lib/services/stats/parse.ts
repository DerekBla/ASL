import { z } from "zod";

import {
  eloRowSchema,
  manifestSchema,
  placementSchema,
  playerSchema,
  playerStatsSchema,
  raceStatsSchema,
  seasonSchema,
  seriesSchema,
  SUPPORTED_SCHEMA_VERSION,
  validationNoteSchema,
} from "./schemas";
import type {
  EloRow,
  Manifest,
  Placement,
  Player,
  PlayerStats,
  RaceStats,
  Season,
  Series,
  ValidationNote,
} from "./schemas";

/** The raw contents of data/generated/, before validation. */
export type RawStats = {
  manifest: unknown;
  seasons: unknown;
  players: unknown;
  placements: unknown;
  series: unknown;
  elo: unknown;
  playerStats: unknown;
  raceStats: unknown;
  validation: unknown;
};

export type StatsData = {
  manifest: Manifest;
  seasons: Season[];
  players: Player[];
  placements: Placement[];
  series: Series[];
  elo: EloRow[];
  playerStats: PlayerStats[];
  raceStats: RaceStats;
  validation: ValidationNote[];
};

/**
 * Thrown when data/generated/ does not match the contract.
 *
 * This deliberately throws instead of returning a result: the data is static and read at
 * build time, so a mismatch is a broken build, not a runtime condition a page can handle.
 */
export class StatsDataError extends Error {
  override readonly name = "StatsDataError";
}

function check<T>(file: string, schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  const first = result.error.issues[0];
  const where = first ? `${first.path.join(".") || "(root)"}: ${first.message}` : "unknown issue";
  throw new StatsDataError(
    `data/generated/${file} does not match the stats contract (${result.error.issues.length} issue(s); first at ${where}). ` +
      "Run `pnpm stats:export`, or update src/lib/services/stats/schemas.ts with the contract.",
  );
}

/** Validates every generated file. The schema version is checked before anything else. */
export function parseStats(raw: RawStats): StatsData {
  const version = z.object({ schemaVersion: z.number() }).safeParse(raw.manifest);
  if (!version.success) {
    throw new StatsDataError("data/generated/manifest.json has no numeric schemaVersion.");
  }
  if (version.data.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new StatsDataError(
      `data/generated/ is schema version ${version.data.schemaVersion}, but this loader supports only ` +
        `${SUPPORTED_SCHEMA_VERSION}. Update src/lib/services/stats/ with Docs/foundation-specs/stats-data.md.`,
    );
  }
  return {
    manifest: check("manifest.json", manifestSchema, raw.manifest),
    seasons: check("seasons.json", z.array(seasonSchema), raw.seasons),
    players: check("players.json", z.array(playerSchema), raw.players),
    placements: check("placements.json", z.array(placementSchema), raw.placements),
    series: check("series.json", z.array(seriesSchema), raw.series),
    elo: check("elo.json", z.array(eloRowSchema), raw.elo),
    playerStats: check("player-stats.json", z.array(playerStatsSchema), raw.playerStats),
    raceStats: check("race-stats.json", raceStatsSchema, raw.raceStats),
    validation: check("validation.json", z.array(validationNoteSchema), raw.validation),
  };
}
