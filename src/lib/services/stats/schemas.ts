/**
 * Zod schemas for data/generated/*.json. They mirror Docs/foundation-specs/stats-data.md.
 *
 * Objects are strict: a field the exporter adds or renames fails validation, so the contract,
 * the exporter and these schemas cannot drift apart silently.
 */
import { z } from "zod";

import { RACES } from "@/lib/types/race";

/** The only manifest.schemaVersion this loader understands. */
export const SUPPORTED_SCHEMA_VERSION = 3;

const raceSchema = z.enum(RACES);
const nullableRace = raceSchema.nullable();
const count = z.number().int().nonnegative();
const seasonNumber = z.number().int().positive();
const share = z.number().min(0).max(1);

export const placementValueSchema = z
  .strictObject({
    label: z.string().min(1),
    best: z.number().int().positive(),
    worst: z.number().int().positive(),
    /** Provisional while the player is still in a season in progress: the places still open. */
    status: z.enum(["final", "provisional"]),
  })
  .refine((p) => p.best <= p.worst, "placement best must not be below worst");

export const seasonSchema = z.strictObject({
  season: seasonNumber,
  name: z.string().min(1),
  start: z.iso.date(),
  end: z.iso.date(),
  prizePoolKrw: count.nullable(),
  players: count,
  winner: z.string().nullable(),
  winnerRace: nullableRace,
  runnerUp: z.string().nullable(),
  runnerUpRace: nullableRace,
  finalScore: z.string().nullable(),
  thirdPlaceMatch: z.boolean(),
  status: z.enum(["complete", "in_progress"]),
  /** Playoff series that are set but not played yet. Empty once a season is complete. */
  upcoming: z.array(
    z.strictObject({
      round: z.enum(["quarterfinal", "semifinal", "final"]),
      players: z.array(z.strictObject({ player: z.string().min(1), race: nullableRace })).length(2),
    }),
  ),
  /** Casts of a playoff round that are titled by broadcast day, so no single series owns them. */
  roundVods: z.array(
    z.strictObject({
      round: z.enum(["quarterfinal", "semifinal"]),
      label: z.string().min(1),
      url: z.url(),
    }),
  ),
  source: z.strictObject({ title: z.string(), url: z.url(), revid: count }),
});

export const playerSchema = z.strictObject({
  player: z.string().min(1),
  race: nullableRace,
  aliases: z.array(z.string()),
});

export const placementSchema = z.strictObject({
  player: z.string().min(1),
  race: nullableRace,
  season: seasonNumber,
  placement: placementValueSchema,
  prizeKrw: count.nullable(),
});

export const seriesSchema = z.strictObject({
  season: seasonNumber,
  stage: z.enum(["ro24", "ro16", "playoffs"]),
  round: z.string().min(1),
  winner: z.string().min(1),
  loser: z.string().min(1),
  winnerRace: nullableRace,
  loserRace: nullableRace,
  score: z.string().nullable(),
  /** Games in the order played. Empty when the source page lists none; map is null when unnamed. */
  games: z.array(z.strictObject({ map: z.string().min(1).nullable(), winner: z.string().min(1) })),
  /** The English cast on YouTube, starting at this series when the source says where. */
  vod: z.url().nullable(),
});

const eloHistory = z.array(z.strictObject({ season: seasonNumber, elo: z.number() }));

export const eloRowSchema = z.strictObject({
  rank: z.number().int().positive(),
  player: z.string().min(1),
  race: nullableRace,
  currentElo: z.number(),
  peakElo: z.number(),
  peakSeason: seasonNumber,
  seasons: count,
  championships: count,
  /** Games played in ASL seasons: what the rating is built from. */
  games: count,
  /** Rating after each season the player entered, oldest first. */
  history: eloHistory,
  /** The same rating with each season's qualifier games counted too. Its own rank and peak. */
  withQualifiers: z.strictObject({
    rank: z.number().int().positive(),
    currentElo: z.number(),
    peakElo: z.number(),
    peakSeason: seasonNumber,
    games: count,
    /** Rating after each season in which the player played a qualifier or ASL game. */
    history: eloHistory,
  }),
});

export const playerStatsSchema = z.strictObject({
  player: z.string().min(1),
  race: nullableRace,
  seasons: count,
  bestFinish: placementValueSchema,
  championships: count,
  finals: count,
  semifinalsOrBetter: count,
  quarterfinalsOrBetter: count,
  prizeKrw: count,
  currentElo: z.number(),
});

const matchupsSchema = z.strictObject({
  crossRace: z.array(
    z.strictObject({
      race: raceSchema,
      vs: raceSchema,
      wins: count,
      losses: count,
      winRate: share.nullable(),
    }),
  ),
  mirrors: z.strictObject({ TvT: count, ZvZ: count, PvP: count }),
  unknownRace: count,
});

export const raceStatsSchema = z.strictObject({
  overall: z.array(
    z.strictObject({
      race: raceSchema,
      championships: count,
      runnerUps: count,
      finalsAppearances: count,
      titleShare: share.nullable(),
      participantSeasons: count,
      participantShare: share.nullable(),
    }),
  ),
  participantsBySeason: z.array(
    z.strictObject({
      season: seasonNumber,
      T: count,
      Z: count,
      P: count,
      unknown: count,
      total: count,
    }),
  ),
  finalsBySeason: z.array(
    z.strictObject({
      season: seasonNumber,
      champion: z.string().nullable(),
      championRace: nullableRace,
      runnerUp: z.string().nullable(),
      runnerUpRace: nullableRace,
      score: z.string().nullable(),
    }),
  ),
  seriesByMatchup: z.strictObject({
    allStages: matchupsSchema,
    playoffs: matchupsSchema,
    finals: matchupsSchema,
  }),
});

export const validationNoteSchema = z.strictObject({ code: z.string(), message: z.string() });

export const manifestSchema = z.strictObject({
  schemaVersion: z.number().int(),
  source: z.strictObject({
    kind: z.literal("liquipedia"),
    license: z.string(),
    wikitextSha256: z.string().length(64),
    pages: z.array(
      z.strictObject({ season: seasonNumber, title: z.string(), url: z.url(), revid: count }),
    ),
  }),
  seasons: z.strictObject({ count, complete: count }),
  counts: z.record(z.string(), count),
  elo: z.strictObject({
    start: z.number(),
    k: z.number(),
    basis: z.literal("game"),
    /** Games in ASL seasons, and in the qualifiers Liquipedia has results for. */
    games: count,
    qualifierGames: count,
    qualifierSeasons: z.array(seasonNumber),
  }),
  warnings: count,
});

export type PlacementValue = z.infer<typeof placementValueSchema>;
export type Season = z.infer<typeof seasonSchema>;
export type Player = z.infer<typeof playerSchema>;
export type Placement = z.infer<typeof placementSchema>;
export type Series = z.infer<typeof seriesSchema>;
export type EloRow = z.infer<typeof eloRowSchema>;
export type PlayerStats = z.infer<typeof playerStatsSchema>;
export type RaceStats = z.infer<typeof raceStatsSchema>;
export type Matchups = z.infer<typeof matchupsSchema>;
export type ValidationNote = z.infer<typeof validationNoteSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
