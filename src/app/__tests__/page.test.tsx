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
  it("leads with stats, then explains the three free games in plain words", () => {
    render(<HomePage />);
    expect(screen.getByText(/^Stats for every season of the ASL/)).toBeInTheDocument();
    const stats = screen.getByRole("region", { name: "Browse the stats" });
    expect(
      within(stats)
        .getAllByRole("link")
        .map((a) => a.getAttribute("href")),
    ).toEqual(["/seasons", "/players", "/elo", "/head-to-head", "/races"]);
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
