/**
 * Brood War costs and build times, keyed by the names the replay parser (screp) uses.
 * Supply is doubled so a Zergling (half a supply) is a whole number. Times are game frames.
 */

export type UnitCost = {
  minerals: number;
  gas: number;
  /** Supply used, doubled. */
  supply: number;
  frames: number;
  /** Supply provided when finished, doubled. */
  provides?: number;
};

const unit = (
  minerals: number,
  gas: number,
  supply: number,
  frames: number,
  provides?: number,
): UnitCost =>
  provides === undefined
    ? { minerals, gas, supply, frames }
    : { minerals, gas, supply, frames, provides };

export const UNITS: Readonly<Record<string, UnitCost>> = {
  // Terran
  SCV: unit(50, 0, 2, 300),
  Marine: unit(50, 0, 2, 360),
  Firebat: unit(50, 25, 2, 360),
  Medic: unit(50, 25, 2, 450),
  Ghost: unit(25, 75, 2, 750),
  Vulture: unit(75, 0, 4, 450),
  "Siege Tank (Tank Mode)": unit(150, 100, 4, 750),
  Goliath: unit(100, 50, 4, 600),
  Wraith: unit(150, 100, 4, 900),
  Dropship: unit(100, 100, 4, 750),
  "Science Vessel": unit(100, 225, 4, 1200),
  Valkyrie: unit(250, 125, 6, 750),
  Battlecruiser: unit(400, 300, 12, 2000),
  // Protoss
  Probe: unit(50, 0, 2, 300),
  Zealot: unit(100, 0, 4, 600),
  Dragoon: unit(125, 50, 4, 750),
  "High Templar": unit(50, 150, 4, 750),
  "Dark Templar": unit(125, 100, 4, 750),
  Shuttle: unit(200, 0, 4, 900),
  Reaver: unit(200, 100, 8, 1050),
  Observer: unit(25, 75, 2, 600),
  Corsair: unit(150, 100, 4, 600),
  Scout: unit(275, 125, 6, 1200),
  Carrier: unit(350, 250, 12, 2100),
  Arbiter: unit(100, 350, 8, 2400),
  // Zerg. One egg gives two Zerglings or two Scourge; the cost and supply are for the pair.
  Drone: unit(50, 0, 2, 300),
  Overlord: unit(100, 0, 0, 600, 16),
  Zergling: unit(50, 0, 2, 420),
  Hydralisk: unit(75, 25, 2, 420),
  Mutalisk: unit(100, 100, 4, 600),
  Scourge: unit(25, 75, 2, 450),
  Queen: unit(100, 100, 4, 750),
  Ultralisk: unit(200, 200, 8, 900),
  Defiler: unit(50, 150, 4, 750),
};

/** Zerg units that morph from another unit, not from a larva. Supply is the extra supply taken. */
export const EVOLUTIONS: Readonly<Record<string, UnitCost>> = {
  Lurker: unit(50, 100, 2, 600),
  Guardian: unit(50, 100, 0, 600),
  Devourer: unit(150, 50, 0, 600),
};

export const BUILDINGS: Readonly<Record<string, UnitCost>> = {
  // Terran
  "Command Center": unit(400, 0, 0, 1800, 20),
  "Supply Depot": unit(100, 0, 0, 600, 16),
  Refinery: unit(100, 0, 0, 600),
  Barracks: unit(150, 0, 0, 1200),
  "Engineering Bay": unit(125, 0, 0, 900),
  Bunker: unit(100, 0, 0, 450),
  Academy: unit(150, 0, 0, 1200),
  "Missile Turret": unit(75, 0, 0, 450),
  Factory: unit(200, 100, 0, 1200),
  Starport: unit(150, 100, 0, 1050),
  Armory: unit(100, 50, 0, 1200),
  "Science Facility": unit(100, 150, 0, 900),
  "Machine Shop": unit(50, 50, 0, 600),
  ComSat: unit(50, 50, 0, 600),
  "Control Tower": unit(50, 50, 0, 600),
  "Nuclear Silo": unit(100, 100, 0, 1200),
  "Physics Lab": unit(50, 50, 0, 600),
  "Covert Ops": unit(50, 50, 0, 600),
  // Protoss
  Nexus: unit(400, 0, 0, 1800, 18),
  Pylon: unit(100, 0, 0, 450, 16),
  Assimilator: unit(100, 0, 0, 600),
  Gateway: unit(150, 0, 0, 900),
  Forge: unit(150, 0, 0, 600),
  "Photon Cannon": unit(150, 0, 0, 750),
  "Cybernetics Core": unit(200, 0, 0, 900),
  "Shield Battery": unit(100, 0, 0, 450),
  "Robotics Facility": unit(200, 200, 0, 1200),
  Stargate: unit(150, 150, 0, 1050),
  "Citadel of Adun": unit(150, 100, 0, 900),
  "Robotics Support Bay": unit(150, 100, 0, 450),
  "Fleet Beacon": unit(300, 200, 0, 900),
  "Templar Archives": unit(150, 200, 0, 900),
  Observatory: unit(50, 100, 0, 450),
  "Arbiter Tribunal": unit(200, 150, 0, 900),
  // Zerg. The Drone that becomes the building is handled by the estimator.
  Hatchery: unit(300, 0, 0, 1800, 2),
  Extractor: unit(50, 0, 0, 600),
  "Spawning Pool": unit(200, 0, 0, 1200),
  "Evolution Chamber": unit(75, 0, 0, 600),
  "Hydralisk Den": unit(100, 50, 0, 600),
  "Creep Colony": unit(75, 0, 0, 300),
  "Sunken Colony": unit(50, 0, 0, 300),
  "Spore Colony": unit(50, 0, 0, 300),
  Lair: unit(150, 100, 0, 1500),
  Spire: unit(200, 150, 0, 1800),
  "Queens Nest": unit(150, 100, 0, 900),
  Hive: unit(200, 150, 0, 1800),
  "Greater Spire": unit(100, 150, 0, 1800),
  "Nydus Canal": unit(150, 0, 0, 600),
  "Ultralisk Cavern": unit(150, 200, 0, 1200),
  "Defiler Mound": unit(100, 100, 0, 900),
};

export const GAS_BUILDINGS: ReadonlySet<string> = new Set(["Refinery", "Assimilator", "Extractor"]);
export const TOWN_HALLS: ReadonlySet<string> = new Set(["Command Center", "Nexus", "Hatchery"]);
export const WORKERS: ReadonlySet<string> = new Set(["SCV", "Probe", "Drone"]);

/** Research cost when the name is not one of the common ones below. */
export const DEFAULT_RESEARCH_COST = { minerals: 150, gas: 150 } as const;

/** Minerals and gas, the same amount of each, for common research. */
export const RESEARCH_COSTS: Readonly<Record<string, number>> = {
  "Tank Siege Mode": 150,
  "Spider Mines": 100,
  "Ion Thrusters (Vulture Speed)": 100,
  "Charon Boosters (Goliath Range)": 100,
  "Stim Packs": 100,
  "U-238 Shells (Marine Range)": 150,
  "Terran Infantry Weapons": 100,
  "Terran Infantry Armor": 100,
  "Terran Vehicle Weapons": 100,
  "Terran Vehicle Plating": 100,
  "Singularity Charge (Dragoon Range)": 150,
  "Leg Enhancement (Zealot Speed)": 150,
  "Protoss Ground Weapons": 100,
  "Protoss Ground Armor": 100,
  "Protoss Air Weapons": 100,
  "Psionic Storm": 200,
  "Metabolic Boost (Zergling Speed)": 100,
  "Lurker Aspect": 200,
  Burrowing: 100,
  "Pneumatized Carapace (Overlord Speed)": 150,
  "Zerg Flyer Attacks": 100,
  "Zerg Flyer Carapace": 150,
  "Zerg Carapace": 150,
  "Zerg Missile Attacks": 100,
  "Zerg Melee Attacks": 100,
};

const DISPLAY_NAMES: Readonly<Record<string, string>> = {
  "Siege Tank (Tank Mode)": "Siege Tank",
  ComSat: "Comsat Station",
  "Queens Nest": "Queen's Nest",
  "Tank Siege Mode": "Siege Mode",
};

/**
 * The name shown in a build order. Research named "Singularity Charge (Dragoon Range)" reads
 * as "Dragoon Range", and race upgrades drop the race: "Terran Vehicle Weapons" becomes
 * "Vehicle Weapons".
 */
export function displayName(name: string): string {
  const fixed = DISPLAY_NAMES[name];
  if (fixed !== undefined) return fixed;
  const inBrackets = /\(([^)]+)\)$/.exec(name);
  if (inBrackets?.[1] !== undefined) return inBrackets[1];
  return name.replace(/^(Terran|Protoss) /, "");
}

/**
 * What has to be standing before a command can even be given: the game does not offer the
 * button otherwise. Terran and Protoss only, by the parser's names. A command for the key
 * proves a finished building of each listed name.
 */
export const REQUIRES: Readonly<Record<string, readonly string[]>> = {
  // Terran units
  Marine: ["Barracks"],
  Firebat: ["Barracks", "Academy"],
  Medic: ["Barracks", "Academy"],
  Ghost: ["Barracks", "Academy", "Covert Ops"],
  Vulture: ["Factory"],
  "Siege Tank (Tank Mode)": ["Factory", "Machine Shop"],
  Goliath: ["Factory", "Armory"],
  Wraith: ["Starport"],
  Dropship: ["Starport", "Control Tower"],
  "Science Vessel": ["Starport", "Control Tower", "Science Facility"],
  Valkyrie: ["Starport", "Control Tower", "Armory"],
  Battlecruiser: ["Starport", "Control Tower", "Physics Lab"],
  // Terran buildings
  Bunker: ["Barracks"],
  Academy: ["Barracks"],
  Factory: ["Barracks"],
  "Missile Turret": ["Engineering Bay"],
  Starport: ["Factory"],
  Armory: ["Factory"],
  "Machine Shop": ["Factory"],
  "Science Facility": ["Starport"],
  "Control Tower": ["Starport"],
  ComSat: ["Academy"],
  "Physics Lab": ["Science Facility"],
  "Covert Ops": ["Science Facility"],
  "Nuclear Silo": ["Covert Ops"],
  // Protoss units
  Zealot: ["Gateway"],
  Dragoon: ["Gateway", "Cybernetics Core"],
  "High Templar": ["Gateway", "Templar Archives"],
  "Dark Templar": ["Gateway", "Templar Archives"],
  Shuttle: ["Robotics Facility"],
  Reaver: ["Robotics Facility", "Robotics Support Bay"],
  Observer: ["Robotics Facility", "Observatory"],
  Corsair: ["Stargate"],
  Scout: ["Stargate"],
  Carrier: ["Stargate", "Fleet Beacon"],
  Arbiter: ["Stargate", "Arbiter Tribunal"],
  // Protoss buildings
  Gateway: ["Pylon"],
  Forge: ["Pylon"],
  "Photon Cannon": ["Forge"],
  "Cybernetics Core": ["Gateway"],
  "Shield Battery": ["Gateway"],
  "Robotics Facility": ["Cybernetics Core"],
  Stargate: ["Cybernetics Core"],
  "Citadel of Adun": ["Cybernetics Core"],
  "Robotics Support Bay": ["Robotics Facility"],
  Observatory: ["Robotics Facility"],
  "Fleet Beacon": ["Stargate"],
  "Templar Archives": ["Citadel of Adun"],
  "Arbiter Tribunal": ["Templar Archives", "Stargate"],
};
