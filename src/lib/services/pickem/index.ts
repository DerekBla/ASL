/**
 * Pick'em reads and writes (Docs/feature-specs/pickem.md). No credits move here.
 *
 * Scores, ranks and achievements are computed from the stored picks and results on every
 * read (lib/pickem), so nothing derived is stored. Other people's picks stay hidden until the
 * pick'em locks; that rule lives here, not in the pages.
 */
import { asc, desc, eq, sql } from "drizzle-orm";

import { achievementsFor } from "@/lib/pickem/achievements";
import type { Achievement } from "@/lib/pickem/achievements";
import {
  checkConfig,
  checkSelection,
  normalizeSelection,
  picksMade,
  totalPicks,
} from "@/lib/pickem/bracket";
import { championOf, rankEntries, scoreEntry, statusOf } from "@/lib/pickem/scoring";
import type { EntryScore } from "@/lib/pickem/scoring";
import { pickemConfigSchema, selectionSchema } from "@/lib/pickem/types";
import type { PickemConfig, PickemStatus, Selection } from "@/lib/pickem/types";
import { pickemEntries, pickems, users } from "@/lib/db/schema";
import type { Db, DbOrTx } from "@/lib/db/types";
import { pickemEntryId } from "@/lib/types/ids";
import type { PickemEntryId, UserId } from "@/lib/types/ids";
import { err, ok } from "@/lib/types/result";
import type { PickemError, Result } from "@/lib/types/result";

export type PickemSummary = {
  season: number;
  title: string;
  locksAt: string;
  status: PickemStatus;
  entries: number;
  /** The real champion, once the last round is decided. */
  champion: string | null;
};

export type PickemView = PickemSummary & {
  config: PickemConfig;
  results: Selection;
  resultsNote: string | null;
};

export type StandingRow = {
  rank: number;
  entryId: number;
  userId: string;
  displayName: string;
  picksMade: number;
  /** null while the pick'em is open: nobody's picks are public yet. */
  championPick: string | null;
  score: EntryScore;
  achievements: Achievement[];
};

export type EntryView = {
  entryId: number;
  season: number;
  userId: string;
  displayName: string;
  updatedAt: string;
  /** null when the pick'em is still open and the reader is not the owner. */
  bracket: {
    picks: Selection;
    score: EntryScore;
    rank: number;
    entries: number;
    achievements: Achievement[];
  } | null;
};

type PickemRow = {
  id: number;
  season: number;
  title: string;
  locksAt: Date;
  config: unknown;
  results: unknown;
  resultsNote: string | null;
  locked: boolean;
  entries: number;
};

const pickemColumns = {
  id: pickems.id,
  season: pickems.season,
  title: pickems.title,
  locksAt: pickems.locksAt,
  config: pickems.config,
  results: pickems.results,
  resultsNote: pickems.resultsNote,
  // The database clock decides whether brackets are locked, as it does for market closes.
  locked: sql<boolean>`${pickems.locksAt} <= now()`,
  // Aliased by hand: Drizzle leaves column names unqualified inside sql subqueries.
  entries: sql<number>`(select count(*)::int from pickem_entries e where e.pickem_id = "pickems"."id")`,
};

function toView(row: PickemRow): PickemView {
  const config = pickemConfigSchema.parse(row.config);
  const results = selectionSchema.parse(row.results);
  return {
    season: row.season,
    title: row.title,
    locksAt: row.locksAt.toISOString(),
    status: statusOf(config, results, row.locked),
    entries: row.entries,
    champion: championOf(config, results),
    config,
    results,
    resultsNote: row.resultsNote,
  };
}

/** Every pick'em, newest season first. */
export async function listPickems(db: DbOrTx): Promise<PickemSummary[]> {
  const rows = await db.select(pickemColumns).from(pickems).orderBy(desc(pickems.season));
  return rows.map((row) => {
    const { season, title, locksAt, status, entries, champion } = toView(row);
    return { season, title, locksAt, status, entries, champion };
  });
}

export async function getPickem(db: DbOrTx, season: number): Promise<PickemView | undefined> {
  const [row] = await db.select(pickemColumns).from(pickems).where(eq(pickems.season, season));
  return row ? toView(row) : undefined;
}

type ScoredEntry = {
  rank: number;
  entryId: number;
  userId: string;
  displayName: string;
  updatedAt: Date;
  picks: Selection;
  score: EntryScore;
  achievements: Achievement[];
};

async function scoredEntries(db: DbOrTx, pickem: PickemView): Promise<ScoredEntry[]> {
  const rows = await db
    .select({
      entryId: pickemEntries.id,
      userId: pickemEntries.userId,
      displayName: users.displayName,
      updatedAt: pickemEntries.updatedAt,
      picks: pickemEntries.picks,
    })
    .from(pickemEntries)
    .innerJoin(users, eq(users.id, pickemEntries.userId))
    .innerJoin(pickems, eq(pickems.id, pickemEntries.pickemId))
    .where(eq(pickems.season, pickem.season))
    .orderBy(asc(pickemEntries.id));

  const { config, results } = pickem;
  const scored = rows.map((row) => {
    const picks = selectionSchema.parse(row.picks);
    return { ...row, picks, score: scoreEntry(config, results, picks) };
  });
  const championPicks = new Map<string, number>();
  for (const entry of scored) {
    const pick = championOf(config, entry.picks);
    if (pick !== null) championPicks.set(pick, (championPicks.get(pick) ?? 0) + 1);
  }
  return rankEntries(scored).map((entry) => {
    const pick = championOf(config, entry.picks);
    return {
      ...entry,
      achievements: achievementsFor(config, results, entry.picks, entry.score, {
        rank: entry.rank,
        entries: scored.length,
        championShare: pick === null ? null : (championPicks.get(pick) ?? 0) / scored.length,
      }),
    };
  });
}

/** Everyone's bracket, ranked. While the pick'em is open it lists who has entered and no more. */
export async function getStandings(db: DbOrTx, pickem: PickemView): Promise<StandingRow[]> {
  const open = pickem.status === "open";
  return (await scoredEntries(db, pickem)).map((entry) => ({
    rank: entry.rank,
    entryId: entry.entryId,
    userId: entry.userId,
    displayName: entry.displayName,
    picksMade: picksMade(pickem.config, entry.picks),
    championPick: open ? null : championOf(pickem.config, entry.picks),
    score: entry.score,
    achievements: entry.achievements,
  }));
}

function toEntryView(pickem: PickemView, entry: ScoredEntry, entries: number): EntryView {
  return {
    entryId: entry.entryId,
    season: pickem.season,
    userId: entry.userId,
    displayName: entry.displayName,
    updatedAt: entry.updatedAt.toISOString(),
    bracket: {
      picks: entry.picks,
      score: entry.score,
      rank: entry.rank,
      entries,
      achievements: entry.achievements,
    },
  };
}

/** One bracket. Its picks are withheld from everyone but the owner until the pick'em locks. */
export async function getEntry(
  db: DbOrTx,
  pickem: PickemView,
  id: PickemEntryId,
  viewer: UserId | undefined,
): Promise<EntryView | undefined> {
  const all = await scoredEntries(db, pickem);
  const entry = all.find((e) => e.entryId === id);
  if (!entry) return undefined;
  const view = toEntryView(pickem, entry, all.length);
  return pickem.status === "open" && entry.userId !== viewer ? { ...view, bracket: null } : view;
}

/** The signed in user's own bracket for a season, if they have one. */
export async function getMyEntry(
  db: DbOrTx,
  pickem: PickemView,
  user: UserId,
): Promise<EntryView | undefined> {
  const all = await scoredEntries(db, pickem);
  const entry = all.find((e) => e.userId === user);
  return entry ? toEntryView(pickem, entry, all.length) : undefined;
}

export type SavePickemInput = {
  season: number;
  title: string;
  locksAt: Date;
  config: PickemConfig;
  adminId: UserId;
};

async function isAdmin(db: DbOrTx, user: UserId): Promise<boolean> {
  const [row] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, user));
  return row?.isAdmin === true;
}

/**
 * Creates a season's pick'em, or edits it. The title and lock time can change at any point;
 * the players and rounds only until the first bracket is saved, since brackets are picks
 * from that list.
 */
export async function savePickem(
  db: Db,
  input: SavePickemInput,
): Promise<Result<{ season: number; created: boolean }, PickemError>> {
  const invalid = (message: string): { error: PickemError } =>
    err({ code: "INVALID_PICKEM", message });
  if (!Number.isSafeInteger(input.season) || input.season <= 0) return invalid("Give a season.");
  if (input.title.trim().length < 3) return invalid("Give the pick'em a title.");
  if (Number.isNaN(input.locksAt.getTime())) return invalid("Pick a lock time.");
  const parsed = pickemConfigSchema.safeParse(input.config);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "Check the setup.");
  const problem = checkConfig(parsed.data);
  if (problem !== null) return invalid(problem);

  return db.transaction(async (tx) => {
    if (!(await isAdmin(tx, input.adminId))) return invalid("Only admins can set up a pick'em.");
    const [existing] = await tx
      .select({ id: pickems.id, config: pickems.config })
      .from(pickems)
      .where(eq(pickems.season, input.season))
      .for("update");
    if (!existing) {
      await tx.insert(pickems).values({
        season: input.season,
        title: input.title.trim(),
        locksAt: input.locksAt,
        config: parsed.data,
        createdBy: input.adminId,
      });
      return ok({ season: input.season, created: true });
    }
    // jsonb does not keep key order; parsing puts both sides in the schema's order.
    const configChanged =
      JSON.stringify(pickemConfigSchema.parse(existing.config)) !== JSON.stringify(parsed.data);
    if (configChanged) {
      const [entry] = await tx
        .select({ id: pickemEntries.id })
        .from(pickemEntries)
        .where(eq(pickemEntries.pickemId, existing.id))
        .limit(1);
      if (entry) return err({ code: "PICKEM_HAS_ENTRIES" as const });
    }
    await tx
      .update(pickems)
      .set({ title: input.title.trim(), locksAt: input.locksAt, config: parsed.data })
      .where(eq(pickems.id, existing.id));
    return ok({ season: input.season, created: false });
  });
}

export type SaveResultsInput = {
  season: number;
  results: Selection;
  note: string;
  adminId: UserId;
};

/** Records who really advanced. Rounds may be filled in bit by bit as the season is played. */
export async function saveResults(
  db: Db,
  input: SaveResultsInput,
): Promise<Result<{ season: number; status: PickemStatus }, PickemError>> {
  return db.transaction(async (tx) => {
    if (!(await isAdmin(tx, input.adminId)))
      return err({ code: "INVALID_PICKEM" as const, message: "Only admins can enter results." });
    const [row] = await tx
      .select({ id: pickems.id, config: pickems.config, locked: pickemColumns.locked })
      .from(pickems)
      .where(eq(pickems.season, input.season))
      .for("update");
    if (!row) return err({ code: "PICKEM_NOT_FOUND" as const });
    const config = pickemConfigSchema.parse(row.config);
    const problem = checkSelection(config, input.results);
    if (problem !== null) return err({ code: "INVALID_PICKS" as const, message: problem });
    const results = normalizeSelection(config, input.results);
    await tx
      .update(pickems)
      .set({
        results,
        resultsNote: input.note.trim() || null,
        resultsUpdatedBy: input.adminId,
        resultsUpdatedAt: sql`now()`,
      })
      .where(eq(pickems.id, row.id));
    return ok({ season: input.season, status: statusOf(config, results, row.locked) });
  });
}

export type SavePicksInput = { season: number; userId: UserId; picks: Selection };

export type SavedPicks = { entryId: PickemEntryId; picksMade: number; totalPicks: number };

/**
 * Saves a user's bracket, replacing the one they had. Refused once the pick'em has locked;
 * the lock is checked against the database clock under a row lock, so a save racing an
 * admin's change to the lock time sees one or the other.
 */
export async function savePicks(
  db: Db,
  input: SavePicksInput,
): Promise<Result<SavedPicks, PickemError>> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: pickems.id, config: pickems.config, locked: pickemColumns.locked })
      .from(pickems)
      .where(eq(pickems.season, input.season))
      .for("share");
    if (!row) return err({ code: "PICKEM_NOT_FOUND" as const });
    if (row.locked) return err({ code: "PICKEM_LOCKED" as const });
    const config = pickemConfigSchema.parse(row.config);
    const problem = checkSelection(config, input.picks);
    if (problem !== null) return err({ code: "INVALID_PICKS" as const, message: problem });
    const picks = normalizeSelection(config, input.picks);
    const [saved] = await tx
      .insert(pickemEntries)
      .values({ pickemId: row.id, userId: input.userId, picks })
      .onConflictDoUpdate({
        target: [pickemEntries.pickemId, pickemEntries.userId],
        set: { picks, updatedAt: sql`now()` },
      })
      .returning({ id: pickemEntries.id });
    if (!saved) throw new Error("bracket upsert returned nothing");
    return ok({
      entryId: pickemEntryId(saved.id),
      picksMade: picksMade(config, picks),
      totalPicks: totalPicks(config),
    });
  });
}
