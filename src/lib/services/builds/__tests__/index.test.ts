import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getBuildReplay, getBuildReplays, getBuildReplaysByPro, getBuildsInfo } from "../index";

describe("builds loader", () => {
  const replays = getBuildReplays();

  it("loads the stored replays, newest first, with unique ids", () => {
    expect(replays.length).toBeGreaterThan(0);
    expect(new Set(replays.map((r) => r.id)).size).toBe(replays.length);
    const times = replays.map((r) => r.playedAt);
    expect(times).toEqual([...times].sort().reverse());
  });

  it("lists the pro first and gives both players a build order", () => {
    for (const replay of replays) {
      const [subject, opponent] = replay.players;
      expect(subject).toMatchObject({ subject: true, pro: replay.pro });
      expect(opponent?.subject).toBe(false);
      for (const player of replay.players) expect(player.steps.length).toBeGreaterThan(0);
    }
  });

  it("keeps every build order inside the frame limit and in time order", () => {
    const { maxFrame } = getBuildsInfo();
    for (const replay of replays) {
      for (const player of replay.players) {
        const frames = player.steps.map((s) => s.frame);
        expect(frames).toEqual([...frames].sort((a, b) => a - b));
        expect(Math.max(...frames)).toBeLessThanOrEqual(maxFrame);
      }
    }
  });

  it("has the replay file for every game, and no game shorter than the cutoff", () => {
    const { minDurationSeconds } = getBuildsInfo();
    for (const replay of replays) {
      expect(existsSync(path.join(process.cwd(), "public", replay.file))).toBe(true);
      expect(replay.durationSeconds).toBeGreaterThanOrEqual(minDurationSeconds);
    }
  });

  it("finds a replay by id and groups replays by pro", () => {
    const first = replays[0];
    expect(getBuildReplay(first?.id ?? "")).toBe(first);
    expect(getBuildReplay("no-such-game")).toBeUndefined();
    const groups = getBuildReplaysByPro();
    expect(groups.reduce((n, g) => n + g.replays.length, 0)).toBe(replays.length);
    for (const group of groups) {
      expect(group.replays.every((r) => r.pro === group.pro)).toBe(true);
    }
  });
});
