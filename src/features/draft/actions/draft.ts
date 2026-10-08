"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { isMarketsEnabled } from "@/lib/config/env";
import { getReadDb, withWriteDb } from "@/lib/db/client";
import { gameWinsSchema } from "@/lib/draft/draft";
import { getViewer } from "@/lib/services/auth";
import type { Viewer } from "@/lib/services/auth";
import { createLeague, joinLeague, makePick, startDraft } from "@/lib/services/draft";
import { countGameWins, fetchWikitext } from "@/lib/services/liquipedia";
import { getPickem, saveGameWins } from "@/lib/services/pickem";
import { findPlayer, getElo } from "@/lib/services/stats";
import { draftLeagueId } from "@/lib/types/ids";
import type { ActionResult } from "@/lib/types/result";

async function asViewer<T>(
  run: (viewer: Viewer) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  if (!isMarketsEnabled())
    return { error: { code: "MARKETS_DISABLED", message: "Drafts aren't switched on yet." } };
  const viewer = await getViewer();
  if (!viewer) return { error: { code: "UNAUTHENTICATED", message: "Sign in to draft." } };
  try {
    return await run(viewer);
  } catch (error) {
    console.error("draft action failed", error);
    return {
      error: { code: "TEMPORARY_FAILURE", message: "Something went wrong on our side. Try again." },
    };
  }
}

const createSchema = z.object({
  season: z.number().int().positive(),
  name: z.string().trim().min(3).max(60),
});

/** Opens a draft league. Players are ranked by ELO for the clock's automatic picks. */
export async function createLeagueAction(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<{ leagueId: number }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success)
    return {
      error: { code: "INVALID_INPUT", message: "Give the draft a name of 3 to 60 letters." },
    };
  return asViewer(async (viewer) => {
    const ranking = [...getElo()].sort((a, b) => b.currentElo - a.currentElo).map((r) => r.player);
    const result = await withWriteDb((db) =>
      createLeague(db, { ...parsed.data, ownerId: viewer.userId, ranking }),
    );
    if ("error" in result) return { error: result.error };
    revalidatePath("/drafts");
    return { data: { leagueId: result.data.leagueId } };
  });
}

const joinSchema = z.object({ code: z.string().min(1).max(40) });

export async function joinLeagueAction(
  input: z.input<typeof joinSchema>,
): Promise<ActionResult<{ leagueId: number }>> {
  const parsed = joinSchema.safeParse(input);
  if (!parsed.success) return { error: { code: "INVALID_INPUT" } };
  return asViewer(async (viewer) => {
    const result = await withWriteDb((db) =>
      joinLeague(db, { code: parsed.data.code, userId: viewer.userId }),
    );
    if ("error" in result) return { error: result.error };
    revalidatePath("/drafts");
    return { data: { leagueId: result.data.leagueId } };
  });
}

const startSchema = z.object({
  leagueId: z.number().int().positive(),
  teamSize: z.number().int().positive().max(64),
});

export async function startDraftAction(
  input: z.input<typeof startSchema>,
): Promise<ActionResult<{ started: true }>> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { error: { code: "INVALID_INPUT" } };
  return asViewer(async (viewer) => {
    const result = await withWriteDb((db) =>
      startDraft(db, {
        leagueId: draftLeagueId(parsed.data.leagueId),
        userId: viewer.userId,
        teamSize: parsed.data.teamSize,
      }),
    );
    if ("error" in result) return { error: result.error };
    return { data: { started: true } };
  });
}

const pickSchema = z.object({
  leagueId: z.number().int().positive(),
  player: z.string().min(1).max(60),
});

export async function makePickAction(
  input: z.input<typeof pickSchema>,
): Promise<ActionResult<{ pickNo: number; drafted: boolean }>> {
  const parsed = pickSchema.safeParse(input);
  if (!parsed.success) return { error: { code: "INVALID_INPUT" } };
  return asViewer(async (viewer) => {
    const result = await withWriteDb((db) =>
      makePick(db, {
        leagueId: draftLeagueId(parsed.data.leagueId),
        userId: viewer.userId,
        player: parsed.data.player,
      }),
    );
    if ("error" in result) return { error: result.error };
    return result;
  });
}

const gameWinsInput = z.object({
  season: z.number().int().positive(),
  gameWins: gameWinsSchema,
});

/** Admin: how many games each player has won so far this season. */
export async function saveGameWinsAction(
  input: z.input<typeof gameWinsInput>,
): Promise<ActionResult<{ season: number }>> {
  const parsed = gameWinsInput.safeParse(input);
  if (!parsed.success)
    return { error: { code: "INVALID_INPUT", message: "Game wins must be whole numbers." } };
  return asViewer(async (viewer) => {
    if (!viewer.isAdmin) return { error: { code: "FORBIDDEN" } };
    const result = await withWriteDb((db) =>
      saveGameWins(db, { ...parsed.data, adminId: viewer.userId }),
    );
    if ("error" in result) return { error: result.error };
    revalidatePath("/admin");
    revalidatePath("/drafts");
    return result;
  });
}

const fetchInput = z.object({
  season: z.number().int().positive(),
  page: z.string().trim().min(1).max(200),
});

export type FetchedGameWins = {
  gameWins: Record<string, number>;
  games: number;
  series: number;
  /** Names on the page that are not players of this season, with their wins. */
  unmatched: { name: string; wins: number }[];
  sourceUrl: string;
};

/**
 * Admin: reads the season's Liquipedia page and counts each player's game wins. Nothing is
 * saved; the admin form shows the numbers to check first.
 */
export async function fetchGameWinsAction(
  input: z.input<typeof fetchInput>,
): Promise<ActionResult<FetchedGameWins>> {
  const parsed = fetchInput.safeParse(input);
  if (!parsed.success)
    return { error: { code: "INVALID_INPUT", message: "Give the Liquipedia page title." } };
  return asViewer(async (viewer) => {
    if (!viewer.isAdmin) return { error: { code: "FORBIDDEN" } };
    const pickem = await getPickem(getReadDb(), parsed.data.season);
    if (!pickem) return { error: { code: "PICKEM_NOT_FOUND" } };
    const page = await fetchWikitext(parsed.data.page);
    if ("error" in page)
      return { error: { code: "TEMPORARY_FAILURE", message: page.error.message } };

    // The page may spell a player differently (JD for Jaedong); match as the stats data does.
    const players = new Map(pickem.config.entrants.map((e) => [e.player.toLowerCase(), e.player]));
    const count = countGameWins(page.data.text);
    const gameWins: Record<string, number> = {};
    const unmatched: FetchedGameWins["unmatched"] = [];
    for (const [name, wins] of Object.entries(count.wins)) {
      const player =
        players.get(name.toLowerCase()) ??
        players.get(findPlayer(name)?.player.toLowerCase() ?? "");
      if (player === undefined) unmatched.push({ name, wins });
      else gameWins[player] = (gameWins[player] ?? 0) + wins;
    }
    return {
      data: {
        gameWins,
        games: count.games,
        series: count.series,
        unmatched,
        sourceUrl: page.data.url,
      },
    };
  });
}
