/**
 * Pick'em shapes (Docs/feature-specs/pickem.md). Pure: no I/O, no clock, no DB types.
 *
 * A pick'em is an ordered list of rounds. For each round a bracket names the players who
 * advance out of it, and every later round is picked from the players advanced before it,
 * so one bracket runs from the first round to the champion.
 */
import { z } from "zod";

import { RACES } from "@/lib/types/race";

const playerName = z.string().trim().min(1).max(60);

export const pickemEntrantSchema = z.strictObject({
  player: playerName,
  race: z.enum(RACES).nullable(),
  /** Group in the first round ("A"). null for players seeded into a later round. */
  group: z.string().trim().min(1).max(20).nullable(),
  /** Index of the first round this player plays in. Seeds skip round 0. */
  entersAt: z.number().int().min(0),
});

export const pickemRoundSchema = z.strictObject({
  key: z
    .string()
    .regex(/^[a-z0-9]+$/)
    .max(20),
  label: z.string().trim().min(1).max(40),
  /** How many players advance out of this round. The last round advances one: the champion. */
  advance: z.number().int().positive(),
  /** Points for each correct pick in this round. */
  points: z.number().int().positive().max(1000),
  /** First round only: how many advance from each group. */
  perGroup: z.number().int().positive().nullable(),
});

export const pickemConfigSchema = z.strictObject({
  entrants: z.array(pickemEntrantSchema).min(2).max(64),
  rounds: z.array(pickemRoundSchema).min(1).max(8),
});

/** Players chosen per round key. Used for a bracket's picks and for the real results. */
export const selectionSchema = z.record(z.string().max(20), z.array(playerName).max(64));

export type PickemEntrant = z.infer<typeof pickemEntrantSchema>;
export type PickemRound = z.infer<typeof pickemRoundSchema>;
export type PickemConfig = z.infer<typeof pickemConfigSchema>;
export type Selection = z.infer<typeof selectionSchema>;

export type PickemStatus = "open" | "live" | "complete";
