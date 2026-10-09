import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EloTopChart } from "../EloTopChart";

const PLAYERS = [
  {
    rank: 1,
    player: "Flash",
    history: [
      { season: 1, elo: 1554.5 },
      { season: 3, elo: 1924.9 },
    ],
  },
  { rank: 2, player: "soma", history: [{ season: 2, elo: 1610 }] },
  { rank: 3, player: "Rain", history: [{ season: 3, elo: 1580.2 }] },
];

function show(): void {
  render(<EloTopChart players={PLAYERS} lastSeason={3} start={1500} />);
}

describe("EloTopChart", () => {
  it("names every player for screen readers and highlights the top one", () => {
    show();
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /Flash, soma, Rain\. Flash is highlighted/,
    );
    expect(screen.getByRole("button", { name: "1.Flash" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("img")).getByText("1,924.9")).toBeInTheDocument();
  });

  it("highlights the player picked from the list", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "2.soma" }));
    expect(screen.getByRole("button", { name: "2.soma" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "1.Flash" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    // soma skipped S3, so the label carries the S2 rating to the right edge.
    expect(within(screen.getByRole("img")).getByText("1,610.0")).toBeInTheDocument();
  });

  it("reads out a season with the arrow keys, holding a rating through skipped seasons", () => {
    show();
    const chart = screen.getByRole("img");
    fireEvent.focus(chart);
    expect(screen.getByRole("status")).toHaveTextContent("Flash1,924.9 after S3");
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(screen.getByRole("status")).toHaveTextContent("Flash1,554.5 after S2");
    fireEvent.click(screen.getByRole("button", { name: "3.Rain" }));
    expect(screen.getByRole("status")).toHaveTextContent("Rainnot yet rated after S2");
  });

  it("offers every season and player as a table", () => {
    show();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(3 + 1);
    expect(within(table).getAllByRole("columnheader")).toHaveLength(PLAYERS.length + 1);
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("S11,554.5––");
  });

  it("says so when there is nothing to draw", () => {
    render(<EloTopChart players={[]} lastSeason={3} start={1500} />);
    expect(screen.getByText("No ELO history yet.")).toBeInTheDocument();
  });
});
