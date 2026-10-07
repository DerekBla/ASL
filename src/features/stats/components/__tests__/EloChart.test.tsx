import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EloChart } from "../EloChart";

const HISTORY = [
  { season: 1, elo: 1554.5 },
  { season: 3, elo: 1924.9 },
  { season: 8, elo: 2092.2 },
  { season: 21, elo: 2010.4 },
];

describe("EloChart", () => {
  it("summarises the line for screen readers, including the peak", () => {
    render(<EloChart player="Flash" history={HISTORY} lastSeason={21} start={1500} />);
    const chart = screen.getByRole("img");
    expect(chart).toHaveAccessibleName(/Flash's ELO after each of 4 seasons/);
    expect(chart).toHaveAccessibleName(/Peak 2,092.2 in S8/);
  });

  it("labels the current value and the peak directly", () => {
    render(<EloChart player="Flash" history={HISTORY} lastSeason={21} start={1500} />);
    const chart = screen.getByRole("img");
    expect(within(chart).getByText("2,010.4")).toBeInTheDocument();
    expect(within(chart).getByText("Peak 2,092.2")).toBeInTheDocument();
  });

  it("offers every point as a table", () => {
    render(<EloChart player="Flash" history={HISTORY} lastSeason={21} start={1500} />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(HISTORY.length + 1);
  });

  it("steps through seasons with the arrow keys", () => {
    render(<EloChart player="Flash" history={HISTORY} lastSeason={21} start={1500} />);
    const chart = screen.getByRole("img");
    fireEvent.focus(chart);
    expect(screen.getByRole("status")).toHaveTextContent("2,010.4after S21");
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(screen.getByRole("status")).toHaveTextContent("2,092.2after S8");
    fireEvent.blur(chart);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says so when there is no history", () => {
    render(<EloChart player="Nobody" history={[]} lastSeason={21} start={1500} />);
    expect(screen.getByText("No ELO history yet.")).toBeInTheDocument();
  });
});
