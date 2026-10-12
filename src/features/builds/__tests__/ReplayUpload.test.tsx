import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReplayReadError } from "@/lib/replay/readReplay";
import type { ReplayBuilds } from "@/lib/replay/readReplay";

import { ReplayUpload, buildOrderText } from "../components/ReplayUpload";
import { parseReplayFile } from "../parseReplayFile";

vi.mock("../parseReplayFile", () => ({ parseReplayFile: vi.fn() }));
const parse = vi.mocked(parseReplayFile);

const GAME: ReplayBuilds = {
  map: "Radeon 1.2",
  frames: 20000,
  speed: "Fastest",
  players: [
    {
      id: 0,
      name: "Stifle",
      race: "T",
      team: 1,
      apm: 150,
      start: 1,
      won: true,
      steps: [
        { frame: 1262, supply: 9, supplyCap: 10, kind: "building", name: "Supply Depot", count: 1 },
        { frame: 2048, supply: 11, supplyCap: 18, kind: "building", name: "Barracks", count: 1 },
        {
          frame: 5000,
          supply: 20,
          supplyCap: 26,
          kind: "building",
          name: "Supply Depot",
          count: 2,
        },
      ],
    },
    { id: 1, name: "Kashll", race: "Z", team: 2, apm: 178, start: 7, won: false, steps: [] },
  ],
};

function pick(name = "game.rep"): void {
  const input = screen.getByLabelText(/Choose a replay/);
  fireEvent.change(input, { target: { files: [new File(["x"], name)] } });
}

describe("ReplayUpload", () => {
  beforeEach(() => {
    parse.mockReset();
  });

  it("says the file stays in the browser", () => {
    render(<ReplayUpload />);
    expect(screen.getByText(/is not sent to the site/)).toBeInTheDocument();
  });

  it("shows each player's build order from the picked replay", async () => {
    parse.mockResolvedValue(GAME);
    render(<ReplayUpload />);
    pick();

    const section = await screen.findByRole("region", { name: "Build order of Stifle" });
    expect(parse).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Radeon 1.2")).toBeInTheDocument();
    expect(screen.getByText("14:00")).toBeInTheDocument();
    expect(screen.getByText(/Supply is a rough guide/)).toBeInTheDocument();
    expect(within(section).getByText("Won")).toBeInTheDocument();

    const rows = within(section).getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      "0:539Supply DepotBuilding",
      "1:2611BarracksBuilding",
      "3:3020Supply Depot 2Building",
    ]);

    const other = screen.getByRole("region", { name: "Build order of Kashll" });
    expect(within(other).getByText(/No build order could be read/)).toBeInTheDocument();
  });

  it("explains a file it cannot read, and recovers on the next one", async () => {
    parse.mockRejectedValueOnce(new ReplayReadError("That is not a replay."));
    render(<ReplayUpload />);
    pick("notes.txt");
    expect(await screen.findByRole("alert")).toHaveTextContent("notes.txt: That is not a replay.");

    parse.mockResolvedValue(GAME);
    pick();
    await screen.findByRole("region", { name: "Build order of Stifle" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not leak an unexpected error's text", async () => {
    parse.mockImplementation(() => Promise.reject(new Error("stack trace here")));
    render(<ReplayUpload />);
    pick();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong reading this replay.",
    );
  });

  it("warns when the game was not played on Fastest", async () => {
    parse.mockResolvedValue({ ...GAME, speed: "Normal" });
    render(<ReplayUpload />);
    pick();
    expect(await screen.findByRole("alert")).toHaveTextContent("played on Normal");
  });

  it("writes a build order as plain lines", () => {
    const first = GAME.players[0];
    if (!first) throw new Error("no player");
    expect(buildOrderText(first)).toBe(
      " 0:53    9  Supply Depot\n 1:26   11  Barracks\n 3:30   20  Supply Depot 2",
    );
  });
});
