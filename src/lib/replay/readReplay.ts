/**
 * From a parsed replay to what the site shows: the game's facts and each player's build order.
 * Pure. The export script and the upload page both go through here, so a replay reads the same
 * way wherever it comes from.
 */
import { estimateBuildOrder, summarizeBuildOrder } from "./buildOrder";
import type { BuildStep, ReplayCommand, ReplayRace } from "./buildOrder";

/** The parts of the parser's (screp's) output this module reads. */
export type ParsedReplay = {
  Header: {
    Map: string;
    Frames: number;
    Speed: { Name: string };
    Players: {
      ID: number;
      Name: string;
      Race: { Name: string };
      Team: number;
      Type: { Name: string };
    }[];
  };
  Commands: { Cmds: ReplayCommand[] } | null;
  Computed: {
    WinnerTeam: number;
    PlayerDescs: { PlayerID: number; APM: number; StartDirection: number }[];
  } | null;
};

export type ReplayPlayer = {
  /** Player id inside the replay. */
  id: number;
  name: string;
  race: "T" | "Z" | "P";
  team: number;
  apm: number;
  /** Start position as a clock hour, 1 to 12. 0 when unknown. */
  start: number;
  /** null when the replay does not say who won. */
  won: boolean | null;
  steps: BuildStep[];
};

export type ReplayBuilds = {
  map: string;
  /** Length of the game in frames. */
  frames: number;
  /** "Fastest" for every ladder game. Times are only right at that speed. */
  speed: string;
  players: ReplayPlayer[];
};

/** Build orders stop here: ten minutes on Fastest. Later supply is too far off to be useful. */
export const BUILD_ORDER_MAX_FRAME = 14286;

const RACE_CODES: Readonly<Record<string, "T" | "Z" | "P">> = {
  Terran: "T",
  Zerg: "Z",
  Protoss: "P",
};

/** Thrown for a replay the site cannot make a build order from. The message is for the user. */
export class ReplayReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayReadError";
  }
}

/** Every human player's build order, in the replay's player order. */
export function readBuildOrders(
  replay: ParsedReplay,
  maxFrame: number = BUILD_ORDER_MAX_FRAME,
): ReplayBuilds {
  const commands = replay.Commands?.Cmds;
  if (!commands) throw new ReplayReadError("This replay has no commands to read.");
  const humans = replay.Header.Players.filter((player) => player.Type.Name === "Human");
  if (humans.length === 0) throw new ReplayReadError("This replay has no human players.");

  const winnerTeam = replay.Computed?.WinnerTeam ?? 0;
  const players = humans.map((player): ReplayPlayer => {
    const race = RACE_CODES[player.Race.Name];
    if (!race) throw new ReplayReadError(`Unknown race for ${player.Name}.`);
    const desc = replay.Computed?.PlayerDescs.find((d) => d.PlayerID === player.ID);
    const steps = estimateBuildOrder(commands, player.ID, player.Race.Name as ReplayRace, maxFrame);
    return {
      id: player.ID,
      name: player.Name,
      race,
      team: player.Team,
      apm: desc?.APM ?? 0,
      start: desc?.StartDirection ?? 0,
      won: winnerTeam === 0 ? null : player.Team === winnerTeam,
      steps: summarizeBuildOrder(steps),
    };
  });

  return {
    // Map names can carry StarCraft color codes (control characters); drop them.
    map: replay.Header.Map.replace(/[\u0000-\u001f]/g, "").trim(),
    frames: replay.Header.Frames,
    speed: replay.Header.Speed.Name,
    players,
  };
}
