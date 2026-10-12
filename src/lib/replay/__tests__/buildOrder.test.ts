import { describe, expect, it } from "vitest";

import { estimateBuildOrder, formatFrame, summarizeBuildOrder } from "../buildOrder";
import type { BuildStep, ReplayCommand } from "../buildOrder";
import { displayName } from "../units";

const ME = 0;

const select = (frame: number, ...tags: number[]): ReplayCommand => ({
  Frame: frame,
  PlayerID: ME,
  Type: { Name: "Select" },
  UnitTags: tags,
});

const unit = (frame: number, type: string, name: string): ReplayCommand => ({
  Frame: frame,
  PlayerID: ME,
  Type: { Name: type },
  Unit: { Name: name },
});

const build = (frame: number, name: string, x: number, y: number): ReplayCommand => ({
  ...unit(frame, "Build", name),
  Order: { Name: "PlaceBuilding" },
  Pos: { X: x, Y: y },
});

const order = (frame: number, type: string, queued = false): ReplayCommand => ({
  Frame: frame,
  PlayerID: ME,
  Type: { Name: type },
  Queued: queued,
});

const names = (steps: readonly BuildStep[]): string[] => steps.map((step) => step.name);

describe("estimateBuildOrder, Terran", () => {
  it("counts one worker when the player clicks five times with money for one", () => {
    const clicks = [3, 5, 7, 9, 11].map((frame) => unit(frame, "Train", "SCV"));
    const steps = estimateBuildOrder([select(1, 1), ...clicks], ME, "Terran");
    expect(names(steps)).toEqual(["SCV"]);
    expect(steps[0]).toMatchObject({ frame: 3, supply: 4, supplyCap: 10, kind: "unit" });
  });

  it("keeps a building the player could pay for, at the time of the command", () => {
    const steps = estimateBuildOrder(
      [select(1490, 2), build(1500, "Supply Depot", 10, 10)],
      ME,
      "Terran",
    );
    expect(steps).toEqual([
      { frame: 1500, supply: 4, supplyCap: 10, kind: "building", name: "Supply Depot", count: 1 },
    ]);
  });

  it("drops a building the player could not pay for", () => {
    const steps = estimateBuildOrder(
      [select(190, 2), build(200, "Command Center", 30, 30)],
      ME,
      "Terran",
    );
    expect(steps).toEqual([]);
  });

  it("drops a building when the SCV is sent elsewhere straight away", () => {
    const commands = [select(1490, 2), build(1500, "Supply Depot", 10, 10)];
    expect(estimateBuildOrder([...commands, order(1510, "Right Click")], ME, "Terran")).toEqual([]);
    // An order queued behind the build is what the SCV does afterwards.
    expect(
      names(estimateBuildOrder([...commands, order(1510, "Right Click", true)], ME, "Terran")),
    ).toEqual(["Supply Depot"]);
  });

  it("takes the last of several clicks on one spot", () => {
    const steps = estimateBuildOrder(
      [select(1490, 2), build(1500, "Supply Depot", 10, 10), build(1506, "Supply Depot", 10, 10)],
      ME,
      "Terran",
    );
    expect(steps.map((step) => [step.name, step.frame])).toEqual([["Supply Depot", 1506]]);
  });

  it("puts back a dropped building when a later command needs it", () => {
    // The Barracks looks unaffordable to the model, but a Marine can only come from one.
    const steps = estimateBuildOrder(
      [
        select(290, 2),
        build(300, "Barracks", 20, 20),
        select(1990, 9),
        unit(2000, "Train", "Marine"),
      ],
      ME,
      "Terran",
    );
    expect(steps.map((step) => [step.name, step.frame])).toEqual([
      ["Barracks", 300],
      ["Marine", 2000],
    ]);
  });

  it("ignores research clicked before any gas building exists", () => {
    const steps = estimateBuildOrder(
      [
        select(1, 1),
        { Frame: 2000, PlayerID: ME, Type: { Name: "Tech" }, Tech: { Name: "Stim Packs" } },
      ],
      ME,
      "Terran",
    );
    expect(steps).toEqual([]);
  });

  it("reads only the asked player and stops at the frame limit", () => {
    const other = { ...unit(3, "Train", "SCV"), PlayerID: 1 };
    const late = unit(5000, "Train", "SCV");
    expect(estimateBuildOrder([other, select(1, 1), late], ME, "Terran", 4000)).toEqual([]);
  });
});

describe("estimateBuildOrder, Zerg", () => {
  it("takes the last attempt on a larva, since an earlier one must have been refused", () => {
    const steps = estimateBuildOrder(
      [
        select(90, 10),
        unit(100, "Unit Morph", "Drone"),
        select(290, 10),
        unit(300, "Unit Morph", "Drone"),
      ],
      ME,
      "Zerg",
    );
    expect(steps.map((step) => [step.name, step.frame, step.supply])).toEqual([["Drone", 300, 4]]);
  });

  it("counts a double click on a larva once", () => {
    const steps = estimateBuildOrder(
      [select(290, 10), unit(300, "Unit Morph", "Drone"), unit(302, "Unit Morph", "Drone")],
      ME,
      "Zerg",
    );
    expect(steps.map((step) => step.frame)).toEqual([300]);
  });

  it("morphs every selected larva", () => {
    const steps = estimateBuildOrder(
      [select(290, 10, 11, 12), unit(300, "Unit Morph", "Zergling")],
      ME,
      "Zerg",
    );
    expect(steps.map((step) => step.supply)).toEqual([4, 5, 6]);
  });

  it("follows the extractor trick", () => {
    const steps = estimateBuildOrder(
      [
        select(490, 20),
        { ...build(500, "Extractor", 7, 2), Order: { Name: "DroneStartBuild" } },
        select(510, 30),
        unit(520, "Unit Morph", "Drone"),
        select(530, 99), // the Extractor, under a tag of its own
        order(540, "Cancel Build"),
        select(590, 31),
        unit(600, "Unit Morph", "Overlord"),
      ],
      ME,
      "Zerg",
    );
    expect(steps.map((step) => [step.name, step.supply, step.cancelled ?? false])).toEqual([
      ["Extractor", 4, true],
      ["Drone", 3, false],
      ["Overlord", 5, false],
    ]);
  });

  it("takes the last build order given to a Drone", () => {
    const pool = (frame: number): ReplayCommand => ({
      ...build(frame, "Spawning Pool", 4, 4),
      Order: { Name: "DroneStartBuild" },
    });
    const steps = estimateBuildOrder([select(490, 20), pool(500), pool(600)], ME, "Zerg");
    expect(steps.map((step) => [step.name, step.frame])).toEqual([["Spawning Pool", 600]]);
  });
});

describe("summarizeBuildOrder", () => {
  const step = (name: string, kind: BuildStep["kind"], count: number): BuildStep => ({
    frame: 0,
    supply: 0,
    supplyCap: 0,
    kind,
    name,
    count,
  });

  it("drops workers and repeat army units, and keeps buildings, research and Overlords", () => {
    const steps = [
      step("SCV", "unit", 1),
      step("Supply Depot", "building", 1),
      step("Marine", "unit", 1),
      step("Marine", "unit", 2),
      step("Supply Depot", "building", 2),
      step("Overlord", "unit", 2),
      step("Stim Packs", "research", 1),
    ];
    expect(names(summarizeBuildOrder(steps))).toEqual([
      "Supply Depot",
      "Marine",
      "Supply Depot",
      "Overlord",
      "Stim Packs",
    ]);
  });
});

describe("display", () => {
  it("shows a frame as the in game clock does on Fastest", () => {
    expect(formatFrame(0)).toBe("0:00");
    expect(formatFrame(1000)).toBe("0:42");
    expect(formatFrame(14286)).toBe("10:00");
  });

  it("shortens the parser's names", () => {
    expect(displayName("Singularity Charge (Dragoon Range)")).toBe("Dragoon Range");
    expect(displayName("Terran Vehicle Weapons")).toBe("Vehicle Weapons");
    expect(displayName("Siege Tank (Tank Mode)")).toBe("Siege Tank");
    expect(displayName("Queens Nest")).toBe("Queen's Nest");
    expect(displayName("Supply Depot")).toBe("Supply Depot");
  });
});
