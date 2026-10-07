import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseStats, StatsDataError } from "../parse";
import { SUPPORTED_SCHEMA_VERSION } from "../schemas";
import type { RawStats } from "../parse";

const GENERATED = join(process.cwd(), "data", "generated");

function read(file: string): unknown {
  return JSON.parse(readFileSync(join(GENERATED, file), "utf8"));
}

/** A fresh copy of the committed data, safe to mutate in a test. */
function rawStats(): RawStats {
  return {
    manifest: read("manifest.json"),
    seasons: read("seasons.json"),
    players: read("players.json"),
    placements: read("placements.json"),
    series: read("series.json"),
    elo: read("elo.json"),
    playerStats: read("player-stats.json"),
    raceStats: read("race-stats.json"),
    validation: read("validation.json"),
  };
}

function firstRow(value: unknown): Record<string, unknown> {
  const row = (value as Record<string, unknown>[])[0];
  if (!row) throw new Error("expected at least one row");
  return row;
}

describe("parseStats", () => {
  it("accepts the committed data/generated files", () => {
    const data = parseStats(rawStats());
    expect(data.manifest.schemaVersion).toBe(SUPPORTED_SCHEMA_VERSION);
    expect(data.seasons).toHaveLength(data.manifest.seasons.count);
    expect(data.players).toHaveLength(data.manifest.counts.players ?? -1);
    expect(data.placements).toHaveLength(data.manifest.counts.placements ?? -1);
    expect(data.series).toHaveLength(data.manifest.counts.series ?? -1);
  });

  it("refuses a schema version it does not know", () => {
    const raw = rawStats();
    (raw.manifest as Record<string, unknown>).schemaVersion = SUPPORTED_SCHEMA_VERSION + 1;
    expect(() => parseStats(raw)).toThrow(StatsDataError);
    expect(() => parseStats(raw)).toThrow(/schema version 4.*supports only 3/);
  });

  it("refuses a manifest with no schema version", () => {
    const raw = rawStats();
    raw.manifest = {};
    expect(() => parseStats(raw)).toThrow(/no numeric schemaVersion/);
  });

  it("names the file and field when a value is wrong", () => {
    const raw = rawStats();
    firstRow(raw.players).race = "X";
    expect(() => parseStats(raw)).toThrow(/players\.json.*0\.race/);
  });

  it("rejects a field the contract does not define", () => {
    const raw = rawStats();
    firstRow(raw.seasons).prizePoolUsdApprox = 12345;
    expect(() => parseStats(raw)).toThrow(/seasons\.json/);
  });

  it("rejects a missing field", () => {
    const raw = rawStats();
    delete firstRow(raw.placements).prizeKrw;
    expect(() => parseStats(raw)).toThrow(/placements\.json.*0\.prizeKrw/);
  });

  it("rejects a placement whose range runs backwards", () => {
    const raw = rawStats();
    firstRow(raw.placements).placement = { label: "8th–5th", best: 8, worst: 5, status: "final" };
    expect(() => parseStats(raw)).toThrow(/placements\.json/);
  });
});
