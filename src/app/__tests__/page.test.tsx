import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getLatestCompleteSeason, getManifest, getSeasonInProgress } from "@/lib/services/stats";

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
    const section = screen.getByRole("region", { name: "What the data covers" });
    expect(within(section).getByText(latest?.winner ?? "missing champion")).toBeInTheDocument();
  });
});

describe("HomePage while a season is being played", () => {
  it("shows what is still to play with each player's chance, and the bracket so far", () => {
    render(<HomePage />);
    const live = getSeasonInProgress();
    const panel = screen.queryByRole("region", { name: /^On now:/ });
    if (!live) {
      expect(panel).not.toBeInTheDocument();
      return;
    }
    if (!panel) throw new Error("expected the panel for the season in progress");
    expect(panel).toHaveTextContent(live.name);
    expect(within(panel).getByRole("link", { name: /Groups, placements/ })).toHaveAttribute(
      "href",
      `/seasons/${live.season}`,
    );
    for (const side of live.upcoming[0]?.players ?? []) {
      expect(within(panel).getAllByRole("link", { name: side.player }).length).toBeGreaterThan(0);
    }
    if (live.upcoming.length > 0) {
      expect(within(panel).getByText(/^ELO gives .+ \d+%/)).toBeInTheDocument();
      // No markets without a database, so the panel makes no request for them.
      expect(within(panel).queryByText("Open markets")).not.toBeInTheDocument();
    }
  });
});

describe("HomePage intro", () => {
  it("leads with stats, then explains the three free games in plain words", () => {
    render(<HomePage />);
    expect(screen.getByText(/^Stats for every season of the ASL/)).toBeInTheDocument();
    const stats = screen.getByRole("region", { name: "Browse the stats" });
    expect(
      within(stats)
        .getAllByRole("link")
        .map((a) => a.getAttribute("href")),
    ).toEqual(["/seasons", "/players", "/elo", "/head-to-head", "/races", "/maps", "/records"]);
    const games = screen.getByRole("region", { name: "Play along" });
    expect(
      within(games)
        .getAllByRole("link")
        .map((a) => a.getAttribute("href")),
    ).toEqual(["/markets", "/pickem", "/drafts"]);
    expect(within(games).getByText(/play money: you get 100 when you sign up/)).toBeInTheDocument();
    expect(screen.queryByText(/betting/i)).not.toBeInTheDocument();
  });

  it("credits stifle with a link to GitHub", () => {
    render(<HomePage />);
    expect(screen.getByRole("link", { name: "stifle" })).toHaveAttribute(
      "href",
      "https://github.com/DerekBla",
    );
    expect(screen.queryByText(/made by fans/i)).not.toBeInTheDocument();
  });
});
