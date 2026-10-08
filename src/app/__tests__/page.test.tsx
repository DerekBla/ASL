import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getLatestCompleteSeason, getManifest } from "@/lib/services/stats";

import HomePage from "../page";

describe("HomePage", () => {
  it("shows what the data covers, from the generated stats", () => {
    render(<HomePage />);
    const { counts } = getManifest();
    const section = screen.getByRole("region", { name: "What the data covers" });
    expect(within(section).getByText("Seasons").nextElementSibling).toHaveTextContent(
      String(counts.seasons),
    );
    expect(within(section).getByText("Players").nextElementSibling).toHaveTextContent(
      String(counts.players),
    );
    expect(within(section).getByText("Series played")).toBeInTheDocument();
  });

  it("names the latest champion", () => {
    render(<HomePage />);
    const latest = getLatestCompleteSeason();
    expect(screen.getByText(latest?.winner ?? "missing champion")).toBeInTheDocument();
  });
});

describe("HomePage intro", () => {
  it("says it is a play money betting site and credits stifle with a link to GitHub", () => {
    render(<HomePage />);
    expect(screen.getByText(/play money betting site/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "stifle" })).toHaveAttribute(
      "href",
      "https://github.com/DerekBla",
    );
    expect(screen.queryByText(/made by fans/i)).not.toBeInTheDocument();
  });
});
