// @vitest-environment node
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { pickems, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import type { Selection } from "@/lib/pickem/types";
import { pickemEntryId, userId } from "@/lib/types/ids";
import type { UserId } from "@/lib/types/ids";

import { createTestDb, makeAdmin } from "@/test/db";
import type { TestDb } from "@/test/db";
import { makePickemConfig, makePickemInput, makeResults } from "@/test/factories/pickem";

import {
  getEntry,
  getMyEntry,
  getPickem,
  getStandings,
  listPickems,
  savePickem,
  savePicks,
  saveResults,
} from "../index";
import type { PickemView } from "../index";

const SEASON = 23;

let t: TestDb;
let db: Db;
let admin: UserId;

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
});

async function newUser(id: string): Promise<UserId> {
  await db.insert(users).values({ id, displayName: id });
  return userId(id);
}

async function open(): Promise<void> {
  const result = await savePickem(db, makePickemInput(admin));
  if ("error" in result) throw new Error(result.error.message ?? result.error.code);
}

async function lock(): Promise<void> {
  await db
    .update(pickems)
    .set({ locksAt: sql`now() - interval '1 minute'` })
    .where(eq(pickems.season, SEASON));
}

async function pick(user: UserId, picks: Selection): Promise<number> {
  const result = await savePicks(db, { season: SEASON, userId: user, picks });
  if ("error" in result) throw new Error(result.error.message ?? result.error.code);
  return result.data.entryId;
}

async function view(): Promise<PickemView> {
  const pickem = await getPickem(db, SEASON);
  if (!pickem) throw new Error("pick'em missing");
  return pickem;
}

describe("savePickem", () => {
  it("creates an open pick'em", async () => {
    await open();
    expect(await listPickems(db)).toMatchObject([
      { season: SEASON, status: "open", entries: 0, champion: null },
    ]);
  });

  it("refuses anyone who is not an admin", async () => {
    const user = await newUser("user_a");
    expect(await savePickem(db, makePickemInput(user))).toMatchObject({
      error: { code: "INVALID_PICKEM" },
    });
    expect(await getPickem(db, SEASON)).toBeUndefined();
  });

  it("refuses a setup that cannot be played", async () => {
    const config = makePickemConfig();
    config.rounds.pop();
    expect(await savePickem(db, makePickemInput(admin, { config }))).toMatchObject({
      error: { code: "INVALID_PICKEM", message: expect.stringMatching(/one champion/) },
    });
  });

  it("lets the lock time move but not the players once a bracket is in", async () => {
    await open();
    await pick(await newUser("user_a"), { groups: ["Flash"] });

    const later = new Date(Date.now() + 14 * 24 * 3600 * 1000);
    expect(await savePickem(db, makePickemInput(admin, { locksAt: later }))).toEqual({
      data: { season: SEASON, created: false },
    });
    expect((await view()).locksAt).toBe(later.toISOString());

    const config = makePickemConfig();
    config.entrants[0] = { player: "Jaehoon", race: null, group: "A", entersAt: 0 };
    expect(await savePickem(db, makePickemInput(admin, { config }))).toEqual({
      error: { code: "PICKEM_HAS_ENTRIES" },
    });
  });
});

describe("savePicks", () => {
  it("saves a bracket and replaces it on the next save", async () => {
    await open();
    const user = await newUser("user_a");
    const first = await pick(user, { groups: ["Rush", "Flash"] });
    const second = await pick(user, makeResults());
    expect(second).toBe(first);
    const mine = await getMyEntry(db, await view(), user);
    expect(mine?.bracket?.picks).toEqual(makeResults());
    expect((await view()).entries).toBe(1);
  });

  it("refuses picks that break the bracket", async () => {
    await open();
    const result = await savePicks(db, {
      season: SEASON,
      userId: await newUser("user_a"),
      picks: { groups: ["Flash"], ro8: ["Rain"] },
    });
    expect(result).toMatchObject({ error: { code: "INVALID_PICKS" } });
  });

  it("refuses a bracket after the lock", async () => {
    await open();
    const user = await newUser("user_a");
    await pick(user, { groups: ["Flash"] });
    await lock();
    expect(await savePicks(db, { season: SEASON, userId: user, picks: makeResults() })).toEqual({
      error: { code: "PICKEM_LOCKED" },
    });
    expect((await getMyEntry(db, await view(), user))?.bracket?.picks).toEqual({
      groups: ["Flash"],
    });
  });

  it("refuses a season with no pick'em", async () => {
    const result = await savePicks(db, { season: 99, userId: await newUser("user_a"), picks: {} });
    expect(result).toEqual({ error: { code: "PICKEM_NOT_FOUND" } });
  });
});

describe("who can see a bracket", () => {
  it("hides picks from other people until the lock, then shows them to everyone", async () => {
    await open();
    const owner = await newUser("user_a");
    const other = await newUser("user_b");
    const id = pickemEntryId(await pick(owner, makeResults()));

    expect((await getEntry(db, await view(), id, owner))?.bracket?.picks).toEqual(makeResults());
    expect((await getEntry(db, await view(), id, other))?.bracket).toBeNull();
    expect((await getEntry(db, await view(), id, undefined))?.bracket).toBeNull();
    expect(await getStandings(db, await view())).toMatchObject([
      { displayName: "user_a", championPick: null, picksMade: 11 },
    ]);

    await lock();
    expect((await getEntry(db, await view(), id, undefined))?.bracket?.picks).toEqual(
      makeResults(),
    );
    expect(await getStandings(db, await view())).toMatchObject([{ championPick: "soma" }]);
  });
});

describe("saveResults and standings", () => {
  it("scores and ranks every bracket as results come in", async () => {
    await open();
    const sharp = await newUser("sharp");
    const off = await newUser("off");
    await pick(sharp, makeResults());
    await pick(off, { groups: ["Flash", "Light"], ro8: ["Light", "Queen"], final: [] });
    await lock();

    const partial = await saveResults(db, {
      season: SEASON,
      results: { groups: ["Flash", "Rain"] },
      note: "Group A",
      adminId: admin,
    });
    expect(partial).toEqual({ data: { season: SEASON, status: "live" } });
    let rows = await getStandings(db, await view());
    expect(rows.map((r) => [r.displayName, r.rank, r.score.points, r.score.wrong])).toEqual([
      ["sharp", 1, 2, 0],
      ["off", 2, 1, 2],
    ]);

    const done = await saveResults(db, {
      season: SEASON,
      results: makeResults(),
      note: "https://liquipedia.net/starcraft/ASL/23",
      adminId: admin,
    });
    expect(done).toEqual({ data: { season: SEASON, status: "complete" } });
    rows = await getStandings(db, await view());
    expect(rows[0]).toMatchObject({ displayName: "sharp", rank: 1, score: { points: 28 } });
    expect(rows[0]?.achievements.map((a) => a.key)).toContain("season_winner");
    expect(rows[1]?.achievements.map((a) => a.key)).toEqual(["podium"]);
    expect(await view()).toMatchObject({ status: "complete", champion: "soma" });
  });

  it("refuses results that could not have happened", async () => {
    await open();
    const result = await saveResults(db, {
      season: SEASON,
      results: { groups: ["Flash"], ro8: ["Light"] },
      note: "",
      adminId: admin,
    });
    expect(result).toMatchObject({ error: { code: "INVALID_PICKS" } });
    expect((await view()).results).toEqual({});
  });

  it("refuses results from anyone who is not an admin", async () => {
    await open();
    const result = await saveResults(db, {
      season: SEASON,
      results: makeResults(),
      note: "",
      adminId: await newUser("user_a"),
    });
    expect(result).toMatchObject({ error: { code: "INVALID_PICKEM" } });
  });
});
