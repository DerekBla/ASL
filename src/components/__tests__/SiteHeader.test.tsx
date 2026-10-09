import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "@/components/SiteHeader";

describe("SiteHeader", () => {
  it("shows the logo next to the site name, linking home", () => {
    render(<SiteHeader />);
    const home = screen.getByRole("link", { name: "StarCoins" });
    expect(home).toHaveAttribute("href", "/");
    expect(home.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("lists every page in one row with no group labels", () => {
    render(<SiteHeader />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getAllByRole("list")).toHaveLength(1);
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual([
      "Seasons",
      "Players",
      "ELO ratings",
      "Head to head",
      "Race stats",
      "Maps",
      "Records",
      "Markets",
      "Market leaderboard",
      "Pick'em",
      "Drafts",
    ]);
    expect(within(nav).queryByText("Stats")).not.toBeInTheDocument();
    expect(within(nav).queryByText("Play")).not.toBeInTheDocument();
  });

  it("puts the search box the layout supplies next to the account control", () => {
    render(<SiteHeader search={<input aria-label="Find a player" />} account={<span>Me</span>} />);
    const box = screen.getByRole("textbox", { name: "Find a player" });
    expect(box.parentElement).toContainElement(screen.getByText("Me"));
  });
});
