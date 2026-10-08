"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { isMarketsEnabled } from "@/lib/config/env";
import { withWriteDb } from "@/lib/db/client";
import { selectionSchema } from "@/lib/pickem/types";
import { getViewer } from "@/lib/services/auth";
import { savePicks } from "@/lib/services/pickem";
import type { ActionResult } from "@/lib/types/result";

const schema = z.object({
  season: z.number().int().positive(),
  picks: selectionSchema,
});

export type SavePicksActionInput = z.input<typeof schema>;

export type SavedBracket = { entryId: number; picksMade: number; totalPicks: number };

/** Saves the signed in user's bracket for a season. The service refuses it after the lock. */
export async function savePicksAction(
  input: SavePicksActionInput,
): Promise<ActionResult<SavedBracket>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: { code: "INVALID_INPUT" } };
  if (!isMarketsEnabled())
    return { error: { code: "MARKETS_DISABLED", message: "Pick'em isn't switched on yet." } };
  const viewer = await getViewer();
  if (!viewer) return { error: { code: "UNAUTHENTICATED", message: "Sign in to save a bracket." } };
  try {
    const result = await withWriteDb((db) =>
      savePicks(db, {
        season: parsed.data.season,
        userId: viewer.userId,
        picks: parsed.data.picks,
      }),
    );
    if ("error" in result) return { error: result.error };
    revalidatePath(`/pickem/${parsed.data.season}`);
    return { data: result.data };
  } catch (error) {
    console.error("saving a bracket failed", error);
    return {
      error: {
        code: "TEMPORARY_FAILURE",
        message: "Something went wrong on our side. Your bracket was not saved; try again.",
      },
    };
  }
}
