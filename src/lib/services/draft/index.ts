/**
 * Fantasy draft leagues (Docs/feature-specs/drafts.md). No credits move here.
 *
 * There is no background worker, so the pick clock is settled lazily: every write, and any
 * read that finds the clock expired, first calls advanceDraft, which makes the picks that
 * timed out. Each timed out pick starts the next clock where the last one ended, so the
 * result is the same whenever the catching up happens. All of it runs under a row lock on the
 * league, against the database clock.
 */
import { randomBytes } from "node:crypto";

import { asc, eq, sql } from "drizzle-orm";

import {
  buildPool,
  draftOrderSchema,
  draftPoolSchema,
  gameWinsSchema,
  MAX_DRAFT_MEMBERS,
  MIN_DRAFT_MEMBERS,
  nextAvailable,
  PICK_SECONDS,
  pickerAt,
  teamSizeOptions,
  teamStandings,
  totalDraftPicks,
} from "@/lib/draft/draft";
import type { DraftStatus, PoolPlayer, TeamStanding } from "@/lib/draft/draft";
import { draftLeagues, draftMembers, draftPicks, pickems, users } from "@/lib/db/schema";
import type { Db, DbOrTx, Tx } from "@/lib/db/types";
import { isComplete } from "@/lib/pickem/scoring";
import { pickemConfigSchema, selectionSchema } from "@/lib/pickem/types";
import { draftLeagueId } from "@/lib/types/ids";
import type { DraftLeagueId, UserId } from "@/lib/types/ids";
import { err, ok } from "@/lib/types/result";
import type { DraftError, Result } from "@/lib/types/result";

export type DraftPickView = { pickNo: number; userId: string; player: string; auto: boolean };

export type LeagueView = {
  id: number;
  name: string;
  season: number;
  seasonTitle: string;
  status: DraftStatus;
  /** The season has locked: a league still in the lobby can no longer draft. */
  seasonStarted: boolean;
  /** The season is decided, so the standings are final. */
  seasonComplete: boolean;
  ownerId: string;
  members: { userId: string; displayName: string }[];
  teamSize: number | null;
  /** Team sizes the owner can choose with the managers now in the lobby. */
  teamSizeOptions: number[];
  pool: PoolPlayer[];
  /** User ids in first round order. null until the draft starts. */
  order: string[] | null;
  picks: DraftPickView[];
  /** Whose pick it is and when their clock runs out. null unless drafting. */
  onClock: { userId: string; pickNo: number; deadline: string } | null;
  /** The database's time when this was read, so browsers can count down without trusting their clock. */
  serverNow: string;
  standings: TeamStanding[];
  /** The invite code. Only members get it. */
  code: string | null;
};

export type LeagueSummary = {
  id: number;
  name: string;
  season: number;
  status: DraftStatus;
  members: number;
  /** The reader's own team, once there are picks. */
  rank: number | null;
  points: number | null;
  champion: boolean;
};

export type Invite = {
  id: number;
  name: string;
  seasonTitle: string;
  status: DraftStatus;
  seasonStarted: boolean;
  members: { userId: string; displayName: string }[];
};

const nowMs = sql<string>`(extract(epoch from now()) * 1000)::bigint`;

const leagueColumns = {
  id: draftLeagues.id,
  pickemId: draftLeagues.pickemId,
  name: draftLeagues.name,
  code: draftLeagues.code,
  ownerId: draftLeagues.ownerId,
  status: draftLeagues.status,
  teamSize: draftLeagues.teamSize,
  pool: draftLeagues.pool,
  order: draftLeagues.order,
  turnStartedAt: draftLeagues.turnStartedAt,
  nowMs,
};

async function membersOf(db: DbOrTx, league: number): Promise<LeagueView["members"]> {
  return db
    .select({ userId: draftMembers.userId, displayName: users.displayName })
    .from(draftMembers)
    .innerJoin(users, eq(users.id, draftMembers.userId))
    .where(eq(draftMembers.leagueId, league))
    .orderBy(asc(draftMembers.joinedAt), asc(draftMembers.userId));
}

async function picksOf(db: DbOrTx, league: number): Promise<DraftPickView[]> {
  return db
    .select({
      pickNo: draftPicks.pickNo,
      userId: draftPicks.userId,
      player: draftPicks.player,
      auto: draftPicks.auto,
    })
    .from(draftPicks)
    .where(eq(draftPicks.leagueId, league))
    .orderBy(asc(draftPicks.pickNo));
}

async function seasonOf(
  db: DbOrTx,
  pickemId: number,
): Promise<{
  season: number;
  title: string;
  config: unknown;
  results: unknown;
  gameWins: unknown;
  locked: boolean;
}> {
  const [row] = await db
    .select({
      season: pickems.season,
      title: pickems.title,
      config: pickems.config,
      results: pickems.results,
      gameWins: pickems.gameWins,
      locked: sql<boolean>`${pickems.locksAt} <= now()`,
    })
    .from(pickems)
    .where(eq(pickems.id, pickemId));
  if (!row) throw new Error(`league points at a missing pick'em ${pickemId}`);
  return row;
}

function deadlineOf(turnStartedAt: Date): Date {
  return new Date(turnStartedAt.getTime() + PICK_SECONDS * 1000);
}

/** The league as anyone may see it. Members also get the invite code. */
export async function getLeagueView(
  db: DbOrTx,
  id: DraftLeagueId,
  viewer: UserId | undefined,
): Promise<LeagueView | undefined> {
  const [league] = await db.select(leagueColumns).from(draftLeagues).where(eq(draftLeagues.id, id));
  if (!league) return undefined;
  const [members, picks, season] = await Promise.all([
    membersOf(db, id),
    picksOf(db, id),
    seasonOf(db, league.pickemId),
  ]);
  const config = pickemConfigSchema.parse(season.config);
  const results = selectionSchema.parse(season.results);
  const pool = draftPoolSchema.parse(league.pool);
  const order = league.order === null ? null : draftOrderSchema.parse(league.order);
  const drafting = league.status === "drafting" && order !== null && league.turnStartedAt !== null;
  return {
    id: league.id,
    name: league.name,
    season: season.season,
    seasonTitle: season.title,
    status: league.status,
    seasonStarted: season.locked,
    seasonComplete: isComplete(config, results),
    ownerId: league.ownerId,
    members,
    teamSize: league.teamSize,
    teamSizeOptions: teamSizeOptions(pool.length, members.length),
    pool,
    order,
    picks,
    onClock:
      drafting && order && league.turnStartedAt
        ? {
            userId: pickerAt(order, picks.length),
            pickNo: picks.length,
            deadline: deadlineOf(league.turnStartedAt).toISOString(),
          }
        : null,
    serverNow: new Date(Number(league.nowMs)).toISOString(),
    standings: teamStandings(
      config,
      results,
      gameWinsSchema.parse(season.gameWins),
      members,
      picks,
    ),
    code: members.some((m) => m.userId === viewer) ? league.code : null,
  };
}

/** What an invite link shows before joining. */
export async function getInvite(db: DbOrTx, code: string): Promise<Invite | undefined> {
  const [league] = await db
    .select({
      id: draftLeagues.id,
      name: draftLeagues.name,
      status: draftLeagues.status,
      pickemId: draftLeagues.pickemId,
    })
    .from(draftLeagues)
    .where(eq(draftLeagues.code, code));
  if (!league) return undefined;
  const [members, season] = await Promise.all([
    membersOf(db, league.id),
    seasonOf(db, league.pickemId),
  ]);
  return {
    id: league.id,
    name: league.name,
    seasonTitle: season.title,
    status: league.status,
    seasonStarted: season.locked,
    members,
  };
}

/** Every league a user is in, newest first, with how their team is doing. */
export async function listLeaguesFor(db: DbOrTx, user: UserId): Promise<LeagueSummary[]> {
  const rows = await db
    .select({ id: draftMembers.leagueId })
    .from(draftMembers)
    .where(eq(draftMembers.userId, user))
    .orderBy(sql`${draftMembers.leagueId} desc`);
  const views = await Promise.all(rows.map((r) => getLeagueView(db, draftLeagueId(r.id), user)));
  return views
    .filter((v) => v !== undefined)
    .map((v) => {
      const mine = v.picks.length > 0 ? v.standings.find((s) => s.userId === user) : undefined;
      return {
        id: v.id,
        name: v.name,
        season: v.season,
        status: v.status,
        members: v.members.length,
        rank: mine?.rank ?? null,
        points: mine?.points ?? null,
        champion: mine?.champion ?? false,
      };
    });
}

export type CreateLeagueInput = {
  season: number;
  name: string;
  ownerId: UserId;
  /** Player names, best first. Decides who an expired clock picks. */
  ranking: readonly string[];
};

/** Opens a league for a season whose players are announced and which has not started. */
export async function createLeague(
  db: Db,
  input: CreateLeagueInput,
): Promise<Result<{ leagueId: DraftLeagueId }, DraftError>> {
  const name = input.name.trim();
  if (name.length < 3 || name.length > 60)
    return err({ code: "INVALID_DRAFT", message: "Give the draft a name of 3 to 60 letters." });
  return db.transaction(async (tx) => {
    const [season] = await tx
      .select({
        id: pickems.id,
        config: pickems.config,
        locked: sql<boolean>`${pickems.locksAt} <= now()`,
      })
      .from(pickems)
      .where(eq(pickems.season, input.season));
    if (!season)
      return err({
        code: "INVALID_DRAFT" as const,
        message: "That season's players are not announced yet.",
      });
    if (season.locked) return err({ code: "DRAFT_SEASON_STARTED" as const });
    const [league] = await tx
      .insert(draftLeagues)
      .values({
        pickemId: season.id,
        name,
        code: randomBytes(9).toString("base64url"),
        ownerId: input.ownerId,
        pool: buildPool(pickemConfigSchema.parse(season.config), input.ranking),
      })
      .returning({ id: draftLeagues.id });
    if (!league) throw new Error("league insert returned nothing");
    await tx.insert(draftMembers).values({ leagueId: league.id, userId: input.ownerId });
    return ok({ leagueId: draftLeagueId(league.id) });
  });
}

/** Joins the league an invite code belongs to. Joining twice is harmless. */
export async function joinLeague(
  db: Db,
  input: { code: string; userId: UserId },
): Promise<Result<{ leagueId: DraftLeagueId }, DraftError>> {
  return db.transaction(async (tx) => {
    const [league] = await tx
      .select({ id: draftLeagues.id, status: draftLeagues.status })
      .from(draftLeagues)
      .where(eq(draftLeagues.code, input.code))
      .for("update");
    if (!league) return err({ code: "DRAFT_NOT_FOUND" as const });
    const members = await membersOf(tx, league.id);
    const leagueId = draftLeagueId(league.id);
    if (members.some((m) => m.userId === input.userId)) return ok({ leagueId });
    if (league.status !== "lobby")
      return err({
        code: "DRAFT_WRONG_STAGE" as const,
        message: "This draft has already started.",
      });
    if (members.length >= MAX_DRAFT_MEMBERS) return err({ code: "DRAFT_FULL" as const });
    await tx.insert(draftMembers).values({ leagueId: league.id, userId: input.userId });
    return ok({ leagueId });
  });
}

function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) [out[i], out[j]] = [b, a];
  }
  return out;
}

/** The owner starts the draft: fixes the team size, draws a random order, starts the clock. */
export async function startDraft(
  db: Db,
  input: { leagueId: DraftLeagueId; userId: UserId; teamSize: number },
): Promise<Result<{ order: string[] }, DraftError>> {
  return db.transaction(async (tx) => {
    const [league] = await tx
      .select(leagueColumns)
      .from(draftLeagues)
      .where(eq(draftLeagues.id, input.leagueId))
      .for("update");
    if (!league) return err({ code: "DRAFT_NOT_FOUND" as const });
    if (league.ownerId !== input.userId)
      return err({
        code: "INVALID_DRAFT" as const,
        message: "Only the person who made the draft can start it.",
      });
    if (league.status !== "lobby") return err({ code: "DRAFT_WRONG_STAGE" as const });
    if ((await seasonOf(tx, league.pickemId)).locked)
      return err({ code: "DRAFT_SEASON_STARTED" as const });
    const members = await membersOf(tx, league.id);
    if (members.length < MIN_DRAFT_MEMBERS)
      return err({
        code: "INVALID_DRAFT" as const,
        message: `A draft needs at least ${MIN_DRAFT_MEMBERS} people.`,
      });
    const pool = draftPoolSchema.parse(league.pool);
    if (!teamSizeOptions(pool.length, members.length).includes(input.teamSize))
      return err({
        code: "INVALID_DRAFT" as const,
        message: "There are not enough players for teams that big.",
      });
    const order = shuffled(members.map((m) => m.userId));
    await tx
      .update(draftLeagues)
      .set({ status: "drafting", teamSize: input.teamSize, order, turnStartedAt: sql`now()` })
      .where(eq(draftLeagues.id, league.id));
    return ok({ order });
  });
}

type LockedLeague = {
  id: number;
  status: DraftStatus;
  teamSize: number | null;
  pool: unknown;
  order: unknown;
  turnStartedAt: Date | null;
  nowMs: string;
};

/**
 * Makes every pick whose clock has run out, inside a transaction that holds the league's row
 * lock. Returns the picks so far, including the ones it just made.
 */
async function settleClock(
  tx: Tx,
  league: LockedLeague,
): Promise<{ picks: DraftPickView[]; order: string[]; pool: PoolPlayer[]; done: boolean }> {
  const pool = draftPoolSchema.parse(league.pool);
  const order = draftOrderSchema.parse(league.order ?? []);
  const picks = await picksOf(tx, league.id);
  const total = totalDraftPicks(order.length, league.teamSize ?? 0);
  if (league.status !== "drafting" || league.turnStartedAt === null)
    return { picks, order, pool, done: league.status === "drafted" };

  const now = Number(league.nowMs);
  const taken = new Set(picks.map((p) => p.player));
  let turnStartedAt = league.turnStartedAt;
  const made: DraftPickView[] = [];
  while (picks.length < total && deadlineOf(turnStartedAt).getTime() <= now) {
    const player = nextAvailable(pool, taken);
    if (player === undefined) break;
    const pick = {
      pickNo: picks.length,
      userId: pickerAt(order, picks.length),
      player,
      auto: true,
    };
    picks.push(pick);
    made.push(pick);
    taken.add(player);
    turnStartedAt = deadlineOf(turnStartedAt);
  }
  const done = picks.length >= total;
  if (made.length > 0) {
    await tx.insert(draftPicks).values(made.map((p) => ({ leagueId: league.id, ...p })));
    await tx
      .update(draftLeagues)
      .set(done ? { status: "drafted", turnStartedAt: null } : { turnStartedAt })
      .where(eq(draftLeagues.id, league.id));
  }
  return { picks, order, pool, done };
}

/** Catches the draft up with the clock. Safe to call at any time, by anyone. */
export async function advanceDraft(db: Db, id: DraftLeagueId): Promise<void> {
  await db.transaction(async (tx) => {
    const [league] = await tx
      .select(leagueColumns)
      .from(draftLeagues)
      .where(eq(draftLeagues.id, id))
      .for("update");
    if (league) await settleClock(tx, league);
  });
}

/** A manager's pick. Expired clocks are settled first, so a late pick finds its turn gone. */
export async function makePick(
  db: Db,
  input: { leagueId: DraftLeagueId; userId: UserId; player: string },
): Promise<Result<{ pickNo: number; drafted: boolean }, DraftError>> {
  return db.transaction(async (tx) => {
    const [league] = await tx
      .select(leagueColumns)
      .from(draftLeagues)
      .where(eq(draftLeagues.id, input.leagueId))
      .for("update");
    if (!league) return err({ code: "DRAFT_NOT_FOUND" as const });
    if (league.status !== "drafting") return err({ code: "DRAFT_WRONG_STAGE" as const });
    const { picks, order, pool, done } = await settleClock(tx, league);
    if (done) return err({ code: "DRAFT_WRONG_STAGE" as const });
    const pickNo = picks.length;
    if (pickerAt(order, pickNo) !== input.userId) return err({ code: "NOT_YOUR_TURN" as const });
    if (!pool.some((p) => p.player === input.player))
      return err({ code: "INVALID_DRAFT" as const, message: "That player is not in this season." });
    if (picks.some((p) => p.player === input.player)) return err({ code: "PLAYER_TAKEN" as const });

    await tx
      .insert(draftPicks)
      .values({ leagueId: league.id, pickNo, userId: input.userId, player: input.player });
    const drafted = pickNo + 1 >= totalDraftPicks(order.length, league.teamSize ?? 0);
    await tx
      .update(draftLeagues)
      .set(drafted ? { status: "drafted", turnStartedAt: null } : { turnStartedAt: sql`now()` })
      .where(eq(draftLeagues.id, league.id));
    return ok({ pickNo, drafted });
  });
}
