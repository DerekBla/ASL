/**
 * Build order from a replay's commands.
 *
 * A replay records what a player clicked, not what happened. There is no supply count in the
 * file, clicks the game refused (no money, full queue) are recorded like any other, and good
 * players click far more than they build. So this module has to decide which commands took
 * effect, and it estimates supply by replaying them. The times are exact. Whether a step
 * happened is a judgement, and supply is an estimate: always label it as a rough guide. Unit
 * deaths are not in a replay either, so supply runs high once fighting starts.
 *
 * How a command is judged:
 * - Zerg: a larva keeps its unit tag when it morphs, so a morph command for a tag that gets
 *   another one later must have been refused. The last attempt on each larva is the one that
 *   worked, and the same holds for a Drone told to build. No income model is needed.
 * - Terran buildings: the SCV has to stay and build. An SCV given something else to do within
 *   a few seconds did not start the building. One left alone for the whole build time gets
 *   longer to reach the spot, since it was probably sent across the map.
 * - Terran and Protoss buildings also have to be affordable, by a simple income model, when the
 *   worker gets there. This drops the build commands players use to move a scout around.
 * - Terran and Protoss units: a queue of five per building, paid for from the same model.
 * - The tech tree overrules the model. The game only offers a command once what it needs is
 *   standing, so training a Wraith proves a Starport. If the model dropped the order for that
 *   Starport, the order is put back.
 *
 * Pure: no I/O, no clock. The export script uses it, and a page can run it in the browser.
 */
import {
  BUILDINGS,
  DEFAULT_RESEARCH_COST,
  EVOLUTIONS,
  GAS_BUILDINGS,
  REQUIRES,
  RESEARCH_COSTS,
  TOWN_HALLS,
  UNITS,
  WORKERS,
  displayName,
} from "./units";
import type { UnitCost } from "./units";

/** The parts of a screp command this module reads. */
export type ReplayCommand = {
  Frame: number;
  PlayerID: number;
  Type: { Name: string };
  Unit?: { Name: string };
  Tech?: { Name: string };
  Upgrade?: { Name: string };
  Order?: { Name: string };
  Pos?: { X: number; Y: number };
  UnitTags?: number[];
  HotkeyType?: { Name: string };
  Group?: number;
  Queued?: boolean;
};

export type ReplayRace = "Terran" | "Zerg" | "Protoss";

export type BuildStep = {
  /** Game frame of the command. On Fastest a frame is 42 ms. */
  frame: number;
  /** Estimated supply used when the command was given. */
  supply: number;
  /** Estimated supply limit at that moment. */
  supplyCap: number;
  kind: "building" | "unit" | "research";
  /** Display name: "Supply Depot", "Dragoon Range". */
  name: string;
  /** 1 for the first of this name, 2 for the second, and so on. For research, the level. */
  count: number;
  /** A Zerg building the player cancelled, such as the Extractor of an extractor trick. */
  cancelled?: true | undefined;
};

/** Milliseconds per frame on Fastest, the speed every ladder game runs at. */
export const FRAME_MS = 42;

const MAX_SUPPLY = 400;
const QUEUE_LIMIT = 5;
/** Workers gather nothing for the first moments while they walk to the minerals. */
const FIRST_INCOME_FRAME = 50;
/** Minerals per frame for a worker with a patch to itself, sharing one, and waiting for one. */
const MINERAL_RATES = [0.048, 0.034, 0.01] as const;
const PATCHES_PER_BASE = 9;
const GAS_PER_WORKER_FRAME = 0.072;
const WORKERS_PER_GAS = 3;
/** An SCV given another order this soon after a build order did not start the building. */
const ABANDON_FRAMES = 240;
/** An SCV left alone for this share of the build time stayed and built. */
const COMMITTED_SHARE = 0.9;
/** The same, for an SCV that then stayed away for the whole build time: a walk to an expansion. */
const COMMITTED_ARRIVAL_FRAMES = 400;
/** How long a worker may take to reach the spot; the money has to be there by then. */
const ARRIVAL_FRAMES = 150;
/** The income model is rough, so a building counts as affordable at this share of its cost. */
const AFFORD_SHARE = 0.9;
/** A second order to the same worker this soon replaces the first: it never got there. */
const REPLACE_FRAMES = 24;
/** Morph commands on one larva this close together are one attempt, clicked more than once. */
const BURST_FRAMES = 48;
/** Leeway when asking whether a building was up in time for the command that needs it. */
const PROOF_SLACK_FRAMES = 120;
/** The same research asked again this soon is a repeated click, not a new level. */
const RESEARCH_REPEAT_FRAMES = 1500;

const SELECTION_TYPES: ReadonlySet<string> = new Set([
  "Select",
  "Select Add",
  "Select Remove",
  "Hotkey",
]);
/** Orders to a building that end an add-on it was told to build. */
const ADDON_ENDERS: ReadonlySet<string> = new Set(["Lift Off", "Build", "Cancel Addon"]);

type Queued = { cost: UnitCost; name: string; started: boolean; end: number };
type Pending = { end: number; done: () => void; cancelled: boolean };
type Placed = { step: BuildStep; cost: UnitCost; pending: Pending };
type Waiting = { name: string; cost: UnitCost; step: BuildStep; deadline: number; pos: string };

/** Follows what a player has selected, from the select and hotkey commands. */
function selectionTracker(): (command: ReplayCommand) => number[] {
  let selection: number[] = [];
  const hotkeys = new Map<number, number[]>();
  return (command) => {
    const type = command.Type.Name;
    const tags = command.UnitTags ?? [];
    if (type === "Select") selection = tags;
    else if (type === "Select Add") selection = [...selection, ...tags];
    else if (type === "Select Remove") selection = selection.filter((tag) => !tags.includes(tag));
    else if (type === "Hotkey" && command.Group !== undefined) {
      const how = command.HotkeyType?.Name;
      if (how === "Assign") hotkeys.set(command.Group, [...selection]);
      else if (how === "Add") {
        hotkeys.set(command.Group, [...(hotkeys.get(command.Group) ?? []), ...selection]);
      } else selection = [...(hotkeys.get(command.Group) ?? selection)];
    }
    return selection;
  };
}

const morphKey = (unitName: string, tag: number): string =>
  unitName in UNITS ? `larva:${tag}` : `${unitName}:${tag}`;

const orderKey = (tag: number, frame: number): string => `${tag}@${frame}`;

type Foresight = {
  /** Zerg: frame of the attempt that worked, per larva, evolving unit or morphing building. */
  morph: Map<string, number>;
  /** Zerg: the build orders to a Drone that happened. */
  droneBuilds: Set<string>;
  /** Terran: build orders the SCV (or, for an add-on, the building) walked away from. */
  abandoned: Set<string>;
  /** Terran: build orders after which the SCV got no other order for the whole build time. */
  committed: Set<string>;
  /** Frames at which each research was clicked. */
  research: Map<string, number[]>;
};

/**
 * One pass over the whole game to learn what only later commands reveal: which attempt on a
 * larva was the last, and whether a worker stayed on the job.
 */
function lookAhead(commands: readonly ReplayCommand[], playerId: number): Foresight {
  const select = selectionTracker();
  const runs = new Map<string, { start: number; last: number }>();
  const lastDroneOrder = new Map<number, number>();
  const droneBuilds = new Set<string>();
  const openBuilds = new Map<number, { frame: number; addon: boolean; frames: number }>();
  const abandoned = new Set<string>();
  const committed = new Set<string>();
  const research = new Map<string, number[]>();

  for (const command of commands) {
    if (command.PlayerID !== playerId) continue;
    const selection = select(command);
    const type = command.Type.Name;
    if (SELECTION_TYPES.has(type)) continue;
    const first = selection[0];

    // Any order that is not queued behind the build ends a build order still within reach.
    if (command.Queued !== true) {
      for (const tag of selection) {
        const open = openBuilds.get(tag);
        if (!open) continue;
        if (open.addon && !ADDON_ENDERS.has(type)) continue;
        const gap = command.Frame - open.frame;
        if (gap <= ABANDON_FRAMES) abandoned.add(orderKey(tag, open.frame));
        else if (!open.addon && gap >= open.frames * COMMITTED_SHARE) {
          committed.add(orderKey(tag, open.frame));
        }
        openBuilds.delete(tag);
      }
    }

    if (type === "Cancel Build" && first !== undefined && lastDroneOrder.has(first)) {
      // A cancelled Zerg building gives the Drone back under the same tag.
      droneBuilds.add(orderKey(first, lastDroneOrder.get(first) ?? 0));
      lastDroneOrder.delete(first);
    }

    const researchName = command.Tech?.Name ?? command.Upgrade?.Name;
    if ((type === "Tech" || type === "Upgrade") && researchName !== undefined) {
      research.set(researchName, [...(research.get(researchName) ?? []), command.Frame]);
    }

    const unitName = command.Unit?.Name;
    if (unitName === undefined) continue;
    if (type === "Unit Morph" || type === "Building Morph") {
      for (const tag of selection) {
        const key = morphKey(unitName, tag);
        const run = runs.get(key);
        if (run && command.Frame - run.last <= BURST_FRAMES) run.last = command.Frame;
        else runs.set(key, { start: command.Frame, last: command.Frame });
      }
    } else if (type === "Build" && first !== undefined) {
      lastDroneOrder.set(first, command.Frame);
      openBuilds.set(first, {
        frame: command.Frame,
        addon: command.Order?.Name === "PlaceAddon",
        frames: BUILDINGS[unitName]?.frames ?? Number.POSITIVE_INFINITY,
      });
    }
  }

  for (const [tag, frame] of lastDroneOrder) droneBuilds.add(orderKey(tag, frame));
  const morph = new Map<string, number>();
  for (const [key, run] of runs) morph.set(key, run.start);
  return { morph, droneBuilds, abandoned, committed, research };
}

/**
 * Every production command of one player that took effect, in order, with the supply
 * estimated for each. Stops at `maxFrame`.
 */
export function estimateBuildOrder(
  commands: readonly ReplayCommand[],
  playerId: number,
  race: ReplayRace,
  maxFrame: number = Number.POSITIVE_INFINITY,
): BuildStep[] {
  const zerg = race === "Zerg";
  const terran = race === "Terran";
  const foresight = lookAhead(commands, playerId);
  const select = selectionTracker();

  let minerals = 50;
  let gas = 0;
  let used = 8;
  let cap = terran ? 20 : 18;
  let workers = 4;
  let gasBuildings = 0;
  let bases = 1;
  let frame = 0;
  let selection: number[] = [];

  const steps: BuildStep[] = [];
  const pending: Pending[] = [];
  const queues = new Map<number, Queued[]>();

  // Terran and Protoss: buildings waiting for their worker and the money, and those placed.
  const waiting = new Map<number, Waiting>();
  const placedAt = new Map<string, Placed>();
  // Start frames of the buildings the model has, by name, and the orders it turned down.
  const built = new Map<string, number[]>([
    ["Command Center", [Number.NEGATIVE_INFINITY]],
    ["Nexus", [Number.NEGATIVE_INFINITY]],
  ]);
  const dropped: Waiting[] = [];
  // Zerg: larvae that became something, eggs still hatching, Drones that became buildings.
  const hatched = new Set<number>();
  const morphed = new Set<string>();
  const eggs = new Map<number, { step: BuildStep; cost: UnitCost; pending: Pending }>();
  const droneBuildings = new Map<number, Placed>();
  const zergPlaced: Placed[] = [];
  // Research under way, by the building doing it.
  const researching = new Map<number, { step: BuildStep; cost: number; key: string }>();
  const lastResearch = new Map<string, number>();

  const after = (frames: number, done: () => void): Pending => {
    const entry = { end: frame + frames, done, cancelled: false };
    pending.push(entry);
    return entry;
  };

  const newStep = (kind: BuildStep["kind"], rawName: string): BuildStep => ({
    frame,
    supply: Math.floor(used / 2),
    supplyCap: Math.floor(cap / 2),
    kind,
    name: displayName(rawName),
    count: 0,
  });

  const record = (kind: BuildStep["kind"], rawName: string): BuildStep => {
    const step = newStep(kind, rawName);
    steps.push(step);
    return step;
  };

  const forget = (step: BuildStep): void => {
    const index = steps.indexOf(step);
    if (index >= 0) steps.splice(index, 1);
  };

  const finishUnit = (name: string, cost: UnitCost): void => {
    if (WORKERS.has(name)) workers++;
    if (cost.provides) cap = Math.min(MAX_SUPPLY, cap + cost.provides);
  };

  const finishBuilding = (name: string, cost: UnitCost): void => {
    if (cost.provides) cap = Math.min(MAX_SUPPLY, cap + cost.provides);
    if (GAS_BUILDINGS.has(name)) gasBuildings++;
    if (TOWN_HALLS.has(name)) bases++;
  };

  const startNext = (queue: Queued[]): void => {
    const head = queue[0];
    if (!head || head.started) return;
    if (head.cost.supply > 0 && used + head.cost.supply > cap) return; // supply blocked
    head.started = true;
    head.end = frame + head.cost.frames;
    used += head.cost.supply;
  };

  const nearlyAffordable = (cost: UnitCost, share: number): boolean =>
    minerals >= cost.minerals * share && gas >= cost.gas * share;

  const spend = (cost: { minerals: number; gas: number }): void => {
    minerals = Math.max(0, minerals - cost.minerals);
    gas = Math.max(0, gas - cost.gas);
  };

  const refund = (cost: { minerals: number; gas: number }): void => {
    minerals += cost.minerals;
    gas += cost.gas;
  };

  /** A Terran or Protoss building starts: the worker is there and the money is spent. */
  const startBuilding = (order: Waiting): void => {
    spend(order.cost);
    steps.push(order.step);
    built.set(order.name, [...(built.get(order.name) ?? []), order.step.frame]);
    const entry = after(order.cost.frames, () => finishBuilding(order.name, order.cost));
    placedAt.set(order.pos, { step: order.step, cost: order.cost, pending: entry });
  };

  /**
   * A command that needs these buildings was given, so each was finished by now. If the model
   * has none old enough, put back the newest order for one that it turned down.
   */
  const prove = (names: readonly string[] | undefined, at: number): void => {
    for (const name of names ?? []) {
      const cost = BUILDINGS[name];
      if (!cost) continue;
      const latestStart = at - cost.frames + PROOF_SLACK_FRAMES;
      if ((built.get(name) ?? []).some((start) => start <= latestStart)) continue;
      let found = -1;
      for (let i = dropped.length - 1; i >= 0 && found < 0; i--) {
        const order = dropped[i];
        if (order && order.name === name && order.step.frame <= latestStart) found = i;
      }
      const order = dropped[found];
      if (!order) continue;
      dropped.splice(found, 1);
      spend(cost);
      steps.push(order.step);
      built.set(name, [...(built.get(name) ?? []), order.step.frame]);
      finishBuilding(name, cost);
      prove(REQUIRES[name], order.step.frame);
    }
  };

  const tick = (): void => {
    frame++;
    if (!zerg && frame > FIRST_INCOME_FRAME) {
      const onGas = Math.min(WORKERS_PER_GAS * gasBuildings, Math.max(0, workers - 6));
      const patches = PATCHES_PER_BASE * bases;
      let left = workers - onGas;
      for (const rate of MINERAL_RATES) {
        const here = Math.min(left, patches);
        minerals += here * rate;
        left -= here;
      }
      gas += onGas * GAS_PER_WORKER_FRAME;
    }
    for (let i = pending.length - 1; i >= 0; i--) {
      const entry = pending[i];
      if (!entry || entry.end > frame) continue;
      pending.splice(i, 1);
      if (!entry.cancelled) entry.done();
    }
    for (const queue of queues.values()) {
      const head = queue[0];
      if (!head) continue;
      if (head.started && head.end <= frame) {
        queue.shift();
        finishUnit(head.name, head.cost);
      }
      startNext(queue);
    }
    for (const [builder, order] of waiting) {
      if (nearlyAffordable(order.cost, AFFORD_SHARE)) {
        waiting.delete(builder);
        startBuilding(order);
      } else if (frame >= order.deadline) {
        waiting.delete(builder); // the money never came
        dropped.push(order);
      }
    }
  };

  const placeZerg = (name: string, cost: UnitCost): void => {
    const drone = selection[0];
    if (drone !== undefined) {
      if (droneBuildings.has(drone)) return;
      // An order to a Drone that is told to build again later did not happen.
      if (!foresight.droneBuilds.has(orderKey(drone, frame))) return;
    }
    const step = record("building", name);
    // The Drone becomes the building: one supply fewer.
    used = Math.max(0, used - 2);
    const entry = after(cost.frames, () => {
      if (drone !== undefined) droneBuildings.delete(drone);
      finishBuilding(name, cost);
    });
    const placed = { step, cost, pending: entry };
    if (drone !== undefined) droneBuildings.set(drone, placed);
    zergPlaced.push(placed);
  };

  const place = (name: string, cost: UnitCost, command: ReplayCommand): void => {
    const builder = selection[0] ?? -1;
    const pos = command.Pos ? `${name}@${command.Pos.X},${command.Pos.Y}` : `${name}@${builder}`;

    // Even an order that came to nothing shows the tech for it was there.
    prove(REQUIRES[name], frame);
    const order = {
      name,
      cost,
      step: newStep("building", name),
      deadline:
        frame +
        (terran && foresight.committed.has(orderKey(builder, frame))
          ? COMMITTED_ARRIVAL_FRAMES
          : ARRIVAL_FRAMES),
      pos,
    };

    // Terran: the SCV (or the building, for an add-on) was soon told to do something else.
    if (terran && foresight.abandoned.has(orderKey(builder, frame))) {
      dropped.push(order);
      return;
    }

    // The same building on the same spot again means the first never started: nothing can be
    // placed on a building that is going up. The later order is the real one.
    const same = placedAt.get(pos);
    if (same && !same.pending.cancelled && same.pending.end > frame) {
      same.pending.cancelled = true;
      refund(same.cost);
      forget(same.step);
    }

    // A new order to a worker still on its way replaces the order it had.
    const earlier = waiting.get(builder);
    if (earlier && (earlier.pos === pos || frame - earlier.step.frame <= REPLACE_FRAMES)) {
      waiting.delete(builder);
      dropped.push(earlier);
    }

    if (nearlyAffordable(cost, AFFORD_SHARE)) startBuilding(order);
    else waiting.set(builder, order);
  };

  const train = (name: string, cost: UnitCost): void => {
    prove(REQUIRES[name], frame);
    const producer = selection[0] ?? -1;
    let queue = queues.get(producer);
    if (!queue) {
      queue = [];
      queues.set(producer, queue);
    }
    if (queue.length >= QUEUE_LIMIT || !nearlyAffordable(cost, 1)) return;
    spend(cost);
    record("unit", name);
    queue.push({ cost, name, started: false, end: 0 });
    startNext(queue);
  };

  const morphFromLarva = (name: string, cost: UnitCost): void => {
    // With no selection known, assume one larva.
    const larvae = selection.length > 0 ? selection : [-1 - steps.length];
    for (const larva of larvae) {
      if (hatched.has(larva)) continue;
      const worked = foresight.morph.get(morphKey(name, larva));
      if (worked !== undefined && worked !== frame) continue;
      const step = record("unit", name);
      used += cost.supply;
      hatched.add(larva);
      const entry = after(cost.frames, () => {
        eggs.delete(larva);
        finishUnit(name, cost);
      });
      eggs.set(larva, { step, cost, pending: entry });
    }
  };

  /** A Zerg unit or building that morphs into another: Lurker, Lair, Sunken Colony. */
  const morphInPlace = (kind: "unit" | "building", name: string, cost: UnitCost): void => {
    const tags = selection.length > 0 ? selection : [-1 - steps.length];
    for (const tag of tags) {
      const key = morphKey(name, tag);
      if (morphed.has(key)) continue;
      const worked = foresight.morph.get(key);
      if (worked !== undefined && worked !== frame) continue;
      morphed.add(key);
      record(kind, name);
      if (kind === "unit") used += cost.supply;
      else break; // one building per command
    }
  };

  const research = (rawName: string): void => {
    // All research costs gas, so a click before any gas building is up was refused.
    if (gasBuildings === 0) return;
    const last = lastResearch.get(rawName);
    if (last !== undefined && frame - last < RESEARCH_REPEAT_FRAMES) return;
    const amount = RESEARCH_COSTS[rawName];
    const cost = amount === undefined ? DEFAULT_RESEARCH_COST : { minerals: amount, gas: amount };
    if (!zerg) {
      // A click with the money clearly missing was refused, if the player then clicked again.
      const short = minerals < cost.minerals / 2 || gas < cost.gas / 2;
      const again = (foresight.research.get(rawName) ?? []).some(
        (at) => at > frame && at - frame < RESEARCH_REPEAT_FRAMES,
      );
      if (short && again) return;
      spend(cost);
    }
    lastResearch.set(rawName, frame);
    const step = record("research", rawName);
    researching.set(selection[0] ?? -1, { step, cost: cost.minerals, key: rawName });
  };

  const cancel = (type: string): void => {
    const target = selection[0] ?? -1;
    if (type === "Cancel Train") {
      const last = queues.get(target)?.pop();
      if (!last) return;
      refund(last.cost);
      if (last.started) used -= last.cost.supply;
      for (let i = steps.length - 1; i >= 0; i--) {
        const step = steps[i];
        if (step && step.kind === "unit" && step.name === displayName(last.name)) {
          steps.splice(i, 1);
          break;
        }
      }
    } else if (type === "Cancel Tech" || type === "Cancel Upgrade") {
      const current = researching.get(target);
      if (!current) return;
      researching.delete(target);
      lastResearch.delete(current.key);
      refund({ minerals: current.cost, gas: current.cost });
      forget(current.step);
    } else if (type === "Cancel Build" || type === "Cancel Morph") {
      const egg = eggs.get(target);
      if (egg && !egg.pending.cancelled) {
        egg.pending.cancelled = true;
        eggs.delete(target);
        hatched.delete(target);
        used -= egg.cost.supply;
        forget(egg.step);
        return;
      }
      // Only Zerg cancels can be followed: a Zerg building keeps its Drone's tag. An Extractor
      // is the exception (it replaces the Drone), so an unknown tag cancels the newest
      // Extractor still going up. That is the extractor trick. Terran and Protoss buildings get
      // tags the replay never ties to the order that placed them, so their cancels are ignored.
      if (type !== "Cancel Build" || !zerg) return;
      let building = droneBuildings.get(target);
      if (!building || building.pending.cancelled) {
        building = undefined;
        for (let i = zergPlaced.length - 1; i >= 0 && !building; i--) {
          const placed = zergPlaced[i];
          if (
            placed &&
            placed.step.name === "Extractor" &&
            !placed.pending.cancelled &&
            placed.pending.end > frame
          ) {
            building = placed;
          }
        }
      }
      if (!building) return;
      building.pending.cancelled = true;
      building.step.cancelled = true;
      for (const [tag, placed] of droneBuildings) {
        if (placed === building) droneBuildings.delete(tag);
      }
      used += 2;
    }
  };

  for (const command of commands) {
    if (command.PlayerID !== playerId) continue;
    if (command.Frame > maxFrame) break;
    while (frame < command.Frame) tick();

    const type = command.Type.Name;
    const unitName = command.Unit?.Name;
    selection = select(command);

    if (type === "Build" && unitName !== undefined) {
      const order = command.Order?.Name;
      // Landing a lifted building and opening a Nydus exit build nothing new.
      if (order === "BuildingLand" || order === "BuildNydusExit") continue;
      const cost = BUILDINGS[unitName];
      if (!cost) continue;
      if (zerg) placeZerg(unitName, cost);
      else place(unitName, cost, command);
    } else if (type === "Building Morph" && unitName !== undefined) {
      const cost = BUILDINGS[unitName];
      if (cost) morphInPlace("building", unitName, cost);
    } else if (type === "Train" && unitName !== undefined) {
      const cost = UNITS[unitName];
      if (cost) train(unitName, cost);
    } else if (type === "Unit Morph" && unitName !== undefined) {
      const evolution = EVOLUTIONS[unitName];
      const cost = UNITS[unitName];
      if (evolution) morphInPlace("unit", unitName, evolution);
      else if (cost) morphFromLarva(unitName, cost);
    } else if (type === "Tech" && command.Tech) research(command.Tech.Name);
    else if (type === "Upgrade" && command.Upgrade) research(command.Upgrade.Name);
    else if (type.startsWith("Cancel")) cancel(type);
  }

  // A building that waited for its money was recorded late; put the steps back in time order
  // and number them.
  const ordered = steps
    .map((step, index) => ({ step, index }))
    .sort((a, b) => a.step.frame - b.step.frame || a.index - b.index)
    .map(({ step }) => step);
  const counts = new Map<string, number>();
  for (const step of ordered) {
    step.count = (counts.get(step.name) ?? 0) + 1;
    counts.set(step.name, step.count);
  }
  return ordered;
}

/**
 * The steps worth showing: every building and research, the first of each kind of army unit,
 * and every Overlord. Workers are left out; the supply column carries them.
 */
export function summarizeBuildOrder(steps: readonly BuildStep[]): BuildStep[] {
  return steps.filter((step) => {
    if (step.kind !== "unit") return true;
    if (WORKERS.has(step.name)) return false;
    return step.count === 1 || step.name === "Overlord";
  });
}

/** Game time of a frame on Fastest, as the in game clock shows it: "4:07". */
export function formatFrame(frame: number): string {
  const seconds = Math.floor((frame * FRAME_MS) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
