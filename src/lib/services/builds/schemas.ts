import { z } from "zod";

import { RACES } from "@/lib/types/race";

/** The builds.json layout this code reads. Bump with the export script. */
export const SUPPORTED_BUILDS_SCHEMA_VERSION = 1;

export const buildStepSchema = z.strictObject({
  frame: z.number().int().nonnegative(),
  supply: z.number().int().nonnegative(),
  supplyCap: z.number().int().nonnegative(),
  kind: z.enum(["building", "unit", "research"]),
  name: z.string().min(1),
  count: z.number().int().positive(),
  cancelled: z.literal(true).optional(),
});

export const buildPlayerSchema = z.strictObject({
  /** Ladder name in the replay. */
  name: z.string().min(1),
  /** The pro cwal.gg says plays this account, if any. */
  pro: z.string().nullable(),
  race: z.enum(RACES),
  /** The player this replay was collected for. */
  subject: z.boolean(),
  apm: z.number().int().nonnegative(),
  /** Start position as a clock hour, 1 to 12. 0 when unknown. */
  start: z.number().int().min(0).max(12),
  steps: z.array(buildStepSchema),
});

export const buildReplaySchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  pro: z.string().min(1),
  proSlug: z.string().regex(/^[a-z0-9-]+$/),
  playedAt: z.iso.datetime(),
  durationSeconds: z.number().int().positive(),
  map: z.string().min(1),
  result: z.enum(["win", "loss"]),
  mmr: z.number().nullable(),
  opponentMmr: z.number().nullable(),
  /** Site path of the replay file, under public/. */
  file: z.string().regex(/^\/replays\/[a-z0-9-]+\/[a-z0-9-]+\.rep$/),
  sourceUrl: z.url(),
  players: z.array(buildPlayerSchema).length(2),
});

export const buildsFileSchema = z.strictObject({
  schemaVersion: z.literal(SUPPORTED_BUILDS_SCHEMA_VERSION),
  source: z.strictObject({ name: z.string(), url: z.url() }),
  minDurationSeconds: z.number().int().positive(),
  maxFrame: z.number().int().positive(),
  replays: z.array(buildReplaySchema),
});

export type BuildStep = z.infer<typeof buildStepSchema>;
export type BuildPlayer = z.infer<typeof buildPlayerSchema>;
export type BuildReplay = z.infer<typeof buildReplaySchema>;
export type BuildsFile = z.infer<typeof buildsFileSchema>;
