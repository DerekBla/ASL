// @vitest-environment node
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { draftLeagues, pickems, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { saveGameWins, savePickem, saveResults } from "@/lib/services/pickem";
import { userId } from "@/lib/types/ids";
import type { DraftLeagueId, UserId } from "@/lib/types/ids";

import { createTestDb, makeAdmin } from "@/test/db";
import type { TestDb } from "@/test/db";
import { makeGameWins, makePickemInput, makeResults } from "@/test/factories/pickem";

import {
  advanceDraft,
  createLeague,
  getInvite,
  getLeagueView,
  joinLeague,
  listLeaguesFor,
  makePick,
  startDraft,
} from "../index";
import type { LeagueView } from "../index";

const SEASON = 23;
const RANKING = ["soma", "Flash", "Soulkey", "Rain"];

let t: TestDb;
let db: Db;
let admin: UserId;
let owner: UserId;

beforeAll(async () => {
  t = await createTestDb();
  db = t.db;
}, 60_000);
afterAll(async () => {
  await t.close();
});
beforeEach(async () => {
  await t.reset();
  admin = await makeAdmin(db);
  owner = await newUser("owner");
  await savePickem(db, makePickemInput(admin));
});

async function newUser(id: string): Promise<UserId> {
  await db.insert(users).values({ id, displayName: id });
  return userId(id);
}

async function newLeague(): Promise<DraftLeagueId> {
  const result = await createLeague(db, {
    season: SEASON,
    name: "ASL Boys",
    ownerId: owner,
    ranking: RANKING,
  });
  if ("error" in result) throw new Error(result.error.message ?? result.error.code);
  return result.data.leagueId;
}

async function view(id: DraftLeagueId, viewer: UserId | undefined = owner): Promise<LeagueView> {
  const league = await getLeagueView(db, id, viewer);
  if (!league) throw new Error("league missing");
  return league;
}

async function join(id: DraftLeagueId, name: string): Promise<UserId> {
  const user = await newUser(name);
  const code = (await view(id)).code ?? "";
  const result = await joinLeague(db, { code, userId: user });
  if ("error" in result) throw new Error(result.error.code);
  return user;
}

/** A league of three in the middle of a draft of two players each. */
async function drafting(): Promise<{ id: DraftLeagueId; order: UserId[] }> {
  const id = await newLeague();
  await join(id, "bo");
  await join(id, "cy");
  const result = await startDraft(db, { leagueId: id, userId: owner, teamSize: 2 });
  if ("error" in result) throw new Error(result.error.code);
  return { id, order: result.data.order.map(userId) };
}

async function rewindClock(id: DraftLeagueId, seconds: number): Promise<void> {
  await db
    .update(draftLeagues)
    .set({ turnStartedAt: sql`now() - make_interval(secs => ${seconds})` })
    .where(eq(draftLeagues.id, id));
}

async function lockSeason(): Promise<void> {
  await db
    .update(pickems)
    .set({ locksAt: sql`now() - interval '1 minute'` })
    .where(eq(pickems.season, SEASON));
}

describe("createLeague", () => {
  it("opens a lobby with the owner in it and the players ranked for the clock", async () => {
    const league = await view(await newLeague());
    expect(league).toMatchObject({
      name: "ASL Boys",
      season: SEASON,
      status: "lobby",
      members: [{ userId: "owner" }],
      teamSize: null,
      onClock: null,
    });
    expect(league.pool.slice(0, 5).map((p) => p.player)).toEqual([...RANKING, "Light"]);
    expect(league.teamSizeOptions).toHaveLength(12);
  });

  it("refuses a season with no players announced, and one that has started", async () => {
    const input = { name: "ASL Boys", ownerId: owner, ranking: RANKING };
    expect(await createLeague(db, { ...input, season: 99 })).toMatchObject({
      error: { code: "INVALID_DRAFT" },
    });
    await lockSeason();
    expect(await createLeague(db, { ...input, season: SEASON })).toEqual({
      error: { code: "DRAFT_SEASON_STARTED" },
    });
  });
});

describe("invites", () => {
  it("shows the invite code to members only", async () => {
    const id = await newLeague();
    expect((await view(id, owner)).code).toMatch(/^[\w-]{12}$/);
    expect((await view(id, await newUser("stranger"))).code).toBeNull();
    expect((await getLeagueView(db, id, undefined))?.code).toBeNull();
  });

  it("lets someone with the code join once", async () => {
    const id = await newLeague();
    const code = (await view(id)).code ?? "";
    const bo = await newUser("bo");
    expect(await joinLeague(db, { code, userId: bo })).toEqual({ data: { leagueId: id } });
    expect(await joinLeague(db, { code, userId: bo })).toEqual({ data: { leagueId: id } });
    expect((await view(id)).members.map((m) => m.userId)).toEqual(["owner", "bo"]);
    expect(await getInvite(db, code)).toMatchObject({ id, name: "ASL Boys", status: "lobby" });
  });

  it("refuses a wrong code, and a new person once the draft has started", async () => {
    const { id } = await drafting();
    const late = await newUser("late");
    expect(await joinLeague(db, { code: "nope", userId: late })).toEqual({
      error: { code: "DRAFT_NOT_FOUND" },
    });
    const code = (await view(id)).code ?? "";
    expect(await joinLeague(db, { code, userId: late })).toMatchObject({
      error: { code: "DRAFT_WRONG_STAGE" },
    });
  });
});

describe("startDraft", () => {
  it("needs the owner, two people, a team size that fits, and a season not yet started", async () => {
    const id = await newLeague();
    const start = (user: UserId, teamSize: number) =>
      startDraft(db, { leagueId: id, userId: user, teamSize });
    expect(await start(owner, 2)).toMatchObject({ error: { code: "INVALID_DRAFT" } }); // alone
    const bo = await join(id, "bo");
    expect(await start(bo, 2)).toMatchObject({ error: { code: "INVALID_DRAFT" } }); // not owner
    expect(await start(owner, 7)).toMatchObject({ error: { code: "INVALID_DRAFT" } }); // 12 players
    await lockSeason();
    expect(await start(owner, 2)).toEqual({ error: { code: "DRAFT_SEASON_STARTED" } });
    expect((await view(id)).status).toBe("lobby");
  });

  it("draws an order and puts the first manager on a 60 second clock", async () => {
    const { id, order } = await drafting();
    const league = await view(id);
    expect([...order].sort()).toEqual(["bo", "cy", "owner"]);
    expect(league).toMatchObject({ status: "drafting", teamSize: 2, order });
    expect(league.onClock).toMatchObject({ userId: order[0], pickNo: 0 });
    const left = Date.parse(league.onClock?.deadline ?? "") - Date.parse(league.serverNow);
    expect(left).toBeGreaterThan(58_000);
    expect(left).toBeLessThanOrEqual(60_000);
  });
});

describe("makePick", () => {
  it("runs the draft in snake order to the end", async () => {
    const { id, order } = await drafting();
    const [a, b, c] = order as [UserId, UserId, UserId];
    const turns: [UserId, string][] = [
      [a, "soma"],
      [b, "Flash"],
      [c, "Rain"],
      [c, "Soulkey"],
      [b, "Bisu"],
      [a, "Rush"],
    ];
    for (const [i, [user, player]] of turns.entries()) {
      expect((await view(id)).onClock?.userId).toBe(user);
      expect(await makePick(db, { leagueId: id, userId: user, player })).toEqual({
        data: { pickNo: i, drafted: i === 5 },
      });
    }
    const league = await view(id);
    expect(league).toMatchObject({ status: "drafted", onClock: null });
    expect(league.picks.map((p) => p.player)).toEqual(turns.map(([, player]) => player));
    expect(league.picks.every((p) => !p.auto)).toBe(true);
  });

  it("refuses a pick out of turn, a taken player, and a player not in the season", async () => {
    const { id, order } = await drafting();
    const [a, b] = order as [UserId, UserId, UserId];
    const pick = (user: UserId, player: string) =>
      makePick(db, { leagueId: id, userId: user, player });
    expect(await pick(b, "soma")).toEqual({ error: { code: "NOT_YOUR_TURN" } });
    expect(await pick(a, "Jaehoon")).toMatchObject({ error: { code: "INVALID_DRAFT" } });
    await pick(a, "soma");
    expect(await pick(b, "soma")).toEqual({ error: { code: "PLAYER_TAKEN" } });
    expect((await view(id)).picks).toHaveLength(1);
  });

  it("refuses a pick before the draft starts", async () => {
    const id = await newLeague();
    expect(await makePick(db, { leagueId: id, userId: owner, player: "soma" })).toEqual({
      error: { code: "DRAFT_WRONG_STAGE" },
    });
  });
});

describe("the pick clock", () => {
  it("picks the best player left for a manager who runs out of time", async () => {
    const { id, order } = await drafting();
    await rewindClock(id, 61);
    await advanceDraft(db, id);
    const league = await view(id);
    expect(league.picks).toEqual([{ pickNo: 0, userId: order[0], player: "soma", auto: true }]);
    expect(league.onClock).toMatchObject({ userId: order[1], pickNo: 1 });
  });

  it("catches up on several missed turns at once, each on its own 60 seconds", async () => {
    const { id, order } = await drafting();
    await rewindClock(id, 130);
    await advanceDraft(db, id);
    const league = await view(id);
    expect(league.picks.map((p) => [p.userId, p.player])).toEqual([
      [order[0], "soma"],
      [order[1], "Flash"],
    ]);
    // Two full clocks are used up; the third manager has the rest of theirs.
    const left = Date.parse(league.onClock?.deadline ?? "") - Date.parse(league.serverNow);
    expect(left).toBeGreaterThan(48_000);
    expect(left).toBeLessThanOrEqual(50_000);
  });

  it("gives a late pick to the clock, not the manager", async () => {
    const { id, order } = await drafting();
    const [a] = order as [UserId, UserId, UserId];
    await rewindClock(id, 61);
    expect(await makePick(db, { leagueId: id, userId: a, player: "Rain" })).toEqual({
      error: { code: "NOT_YOUR_TURN" },
    });
    expect((await view(id)).picks).toEqual([{ pickNo: 0, userId: a, player: "soma", auto: true }]);
  });

  it("finishes an abandoned draft on its own", async () => {
    const { id } = await drafting();
    await rewindClock(id, 6 * 60 + 1);
    await advanceDraft(db, id);
    const league = await view(id);
    expect(league).toMatchObject({ status: "drafted", onClock: null });
    expect(league.picks).toHaveLength(6);
    expect(league.picks.every((p) => p.auto)).toBe(true);
  });

  it("leaves a draft alone while the clock is running", async () => {
    const { id } = await drafting();
    await advanceDraft(db, id);
    expect((await view(id)).picks).toEqual([]);
  });
});

describe("standings", () => {
  it("scores a point per game won and crowns a champion once the season is decided", async () => {
    const { id, order } = await drafting();
    await rewindClock(id, 6 * 60 + 1);
    await advanceDraft(db, id);
    // Snake over the ranking soma, Flash, Soulkey, Rain, Light, Mini.
    const [a, b, c] = order as [UserId, UserId, UserId];
    await lockSeason();
    await saveGameWins(db, { season: SEASON, gameWins: makeGameWins(), adminId: admin });
    const table = async (): Promise<unknown[]> =>
      (await view(id)).standings.map((s) => [s.userId, s.rank, s.points, s.champion]);
    // Level on points, so the tie is listed by name.
    expect(await table()).toEqual(
      [
        [a, 1, 9, false], // soma 9, Mini 0
        [b, 1, 9, false], // Flash 8, Light 1
      ]
        .sort((x, y) => String(x[0]).localeCompare(String(y[0])))
        .concat([[c, 3, 6, false]]), // Soulkey 4, Rain 2
    );

    const final = { ...makeGameWins(), soma: 12 };
    await saveGameWins(db, { season: SEASON, gameWins: final, adminId: admin });
    await saveResults(db, { season: SEASON, results: makeResults(), note: "", adminId: admin });
    expect((await view(id)).seasonComplete).toBe(true);
    expect(await table()).toEqual([
      [a, 1, 12, true],
      [b, 2, 9, false],
      [c, 3, 6, false],
    ]);
    expect(await listLeaguesFor(db, a)).toMatchObject([
      { id, name: "ASL Boys", status: "drafted", members: 3, rank: 1, points: 12, champion: true },
    ]);
    expect(await listLeaguesFor(db, admin)).toEqual([]);
  });
});
