/**
 * Reads a league for a page or the polling route, settling the pick clock first when it has
 * run out. Reads go over neon-http; the write connection is opened only when a pick is due.
 */
import "server-only";

import { getReadDb, withWriteDb } from "@/lib/db/client";
import type { DraftLeagueId, UserId } from "@/lib/types/ids";

import { advanceDraft, getLeagueView } from "./index";
import type { LeagueView } from "./index";

export async function readLeague(
  id: DraftLeagueId,
  viewer: UserId | undefined,
): Promise<LeagueView | undefined> {
  const view = await getLeagueView(getReadDb(), id, viewer);
  if (!view?.onClock || Date.parse(view.onClock.deadline) > Date.parse(view.serverNow)) return view;
  await withWriteDb((db) => advanceDraft(db, id));
  return getLeagueView(getReadDb(), id, viewer);
}
