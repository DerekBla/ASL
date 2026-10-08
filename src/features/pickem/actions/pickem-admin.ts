"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { isMarketsEnabled } from "@/lib/config/env";
import { withWriteDb } from "@/lib/db/client";
import { pickemRoundSchema, selectionSchema } from "@/lib/pickem/types";
import type { PickemStatus } from "@/lib/pickem/types";
import { getViewer } from "@/lib/services/auth";
import { savePickem, saveResults } from "@/lib/services/pickem";
import { findPlayer } from "@/lib/services/stats";
import type { UserId } from "@/lib/types/ids";
import { RACES } from "@/lib/types/race";
import type { ActionResult } from "@/lib/types/result";

async function asAdmin<T>(
  run: (admin: UserId) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  if (!isMarketsEnabled()) return { error: { code: "MARKETS_DISABLED" } };
  const viewer = await getViewer();
  if (!viewer) return { error: { code: "UNAUTHENTICATED" } };
  if (!viewer.isAdmin) return { error: { code: "FORBIDDEN" } };
  try {
    return await run(viewer.userId);
  } catch (error) {
    console.error("pick'em admin action failed", error);
    return {
      error: { code: "TEMPORARY_FAILURE", message: "Something went wrong on our side. Try again." },
    };
  }
}

function refresh(season: number): void {
  revalidatePath("/pickem");
  revalidatePath(`/pickem/${season}`);
  revalidatePath("/admin");
}

const pickemSchema = z.object({
  season: z.number().int().positive(),
  title: z.string().trim().min(3).max(120),
  locksAt: z.iso.datetime(),
  entrants: z
    .array(
      z.object({
        player: z.string().trim().min(1).max(60),
        race: z.enum(RACES).nullable(),
        group: z.string().trim().min(1).max(20).nullable(),
        entersAt: z.number().int().min(0),
      }),
    )
    .min(2)
    .max(64),
  rounds: z.array(pickemRoundSchema).min(1).max(8),
});

export type SavePickemActionInput = z.input<typeof pickemSchema>;

/**
 * Creates or edits a season's pick'em. Names the stats data knows are stored in their
 * canonical spelling, and a race left blank is filled in from the stats data.
 */
export async function savePickemAction(
  input: SavePickemActionInput,
): Promise<ActionResult<{ season: number; created: boolean }>> {
  const parsed = pickemSchema.safeParse(input);
  if (!parsed.success)
    return {
      error: {
        code: "INVALID_INPUT",
        message: parsed.error.issues[0]?.message ?? "Check the form.",
      },
    };
  return asAdmin(async (admin) => {
    const d = parsed.data;
    const entrants = d.entrants.map((e) => {
      const known = findPlayer(e.player);
      return { ...e, player: known?.player ?? e.player, race: e.race ?? known?.race ?? null };
    });
    const result = await withWriteDb((db) =>
      savePickem(db, {
        season: d.season,
        title: d.title,
        locksAt: new Date(d.locksAt),
        config: { entrants, rounds: d.rounds },
        adminId: admin,
      }),
    );
    if ("error" in result) return { error: result.error };
    refresh(d.season);
    return result;
  });
}

const resultsSchema = z.object({
  season: z.number().int().positive(),
  results: selectionSchema,
  note: z.string().max(500),
});

export async function saveResultsAction(
  input: z.input<typeof resultsSchema>,
): Promise<ActionResult<{ season: number; status: PickemStatus }>> {
  const parsed = resultsSchema.safeParse(input);
  if (!parsed.success) return { error: { code: "INVALID_INPUT" } };
  return asAdmin(async (admin) => {
    const result = await withWriteDb((db) => saveResults(db, { ...parsed.data, adminId: admin }));
    if ("error" in result) return { error: result.error };
    refresh(parsed.data.season);
    return result;
  });
}
