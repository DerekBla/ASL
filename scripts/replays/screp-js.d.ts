declare module "screp-js" {
  import type { ReplayCommand } from "../../src/lib/replay/buildOrder";

  export type ScrepPlayer = {
    ID: number;
    Name: string;
    Race: { Name: string };
    Team: number;
    Type: { Name: string };
  };

  export type ScrepReplay = {
    Header: { Map: string; Frames: number; Speed: { Name: string }; Players: ScrepPlayer[] };
    Commands: { Cmds: ReplayCommand[] };
    Computed: {
      WinnerTeam: number;
      PlayerDescs: { PlayerID: number; APM: number; EAPM: number; StartDirection: number }[];
    };
  };

  const Screp: {
    parseBuffer(bytes: Uint8Array, options?: { cmds?: boolean }): Promise<ScrepReplay>;
  };
  export default Screp;
}
