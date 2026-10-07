import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getElo, getPlayers, getSeasons } from "@/lib/services/stats";

import EloPage from "../elo/page";
import HeadToHeadPage from "../head-to-head/page";
import PlayerPage, { generateStaticParams as playerParams } from "../players/[slug]/page";
import PlayersPage from "../players/page";
import RacesPage from "../races/page";
import SeasonPage, { generateStaticParams as seasonParams } from "../seasons/[season]/page";
import SeasonsPage from "../seasons/page";

function rowsOf(table: HTMLElement): HTMLElement[] {
  return within(table).getAllByRole("row").slice(1);
}

describe("/seasons", () => {
  it("lists every season, newest first, with links to each", () => {
    render(<SeasonsPage />);
    const rows = rowsOf(screen.getByRole("table"));
    expect(rows).toHaveLength(getSeasons().length);
    expect(within(rows[0] as HTMLElement).getByRole("link", { name: /S21/ })).toHaveAttribute(
      "href",
      "/seasons/21",
    );
  });
});

describe("/seasons/[season]", () => {
  it("pre-renders every season", () => {
    expect(seasonParams()).toHaveLength(getSeasons().length);
  });

  it("shows the final, playoffs and all placements", async () => {
    render(await SeasonPage({ params: Promise.resolve({ season: "5" }) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("ASL Season 5");
    expect(screen.getByRole("heading", { name: "Third-place match" })).toBeInTheDocument();
    const placements = screen.getByRole("table", { name: /best finish first/ });
    expect(rowsOf(placements)).toHaveLength(28);
    expect(within(rowsOf(placements)[0] as HTMLElement).getByText("Rain")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /StarCraft League Remastered\/5/ })).toHaveAttribute(
      "href",
      expect.stringContaining("liquipedia.net"),
    );
  });

  it("is a 404 for a season that does not exist", async () => {
    await expect(SeasonPage({ params: Promise.resolve({ season: "99" }) })).rejects.toThrow();
  });
});

describe("/players", () => {
  it("lists every player with a link to their page", () => {
    render(<PlayersPage />);
    expect(rowsOf(screen.getByRole("table"))).toHaveLength(getPlayers().length);
    expect(screen.getByRole("link", { name: "tulbo" })).toHaveAttribute("href", "/players/tulbo");
  });
});

describe("/players/[slug]", () => {
  it("pre-renders every player", () => {
    expect(playerParams()).toHaveLength(getPlayers().length);
  });

  it("shows career stats, every season and the series record", async () => {
    render(await PlayerPage({ params: Promise.resolve({ slug: "flash" }) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Flash");
    expect(screen.getByText("Championships").nextElementSibling).toHaveTextContent("4");
    expect(screen.getByRole("table", { name: /seasons entered/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Series record" })).toBeInTheDocument();
  });

  it("lists the other spellings of a merged player", async () => {
    render(await PlayerPage({ params: Promise.resolve({ slug: "tulbo" }) }));
    expect(screen.getByText(/Also written as/)).toHaveTextContent("huro");
  });

  it("is a 404 for an unknown player", async () => {
    await expect(PlayerPage({ params: Promise.resolve({ slug: "nobody" }) })).rejects.toThrow();
  });
});

describe("/elo", () => {
  it("shows the spreadsheet's columns, in rank order, and says it is placement-based", () => {
    render(<EloPage />);
    const table = screen.getByRole("table");
    for (const header of [
      "Rank",
      "Player",
      "Race",
      "Current ELO",
      "Peak ELO",
      "Peak season",
      "Seasons",
      "Championships",
    ]) {
      expect(
        within(table).getByRole("columnheader", { name: new RegExp(header) }),
      ).toBeInTheDocument();
    }
    const top = getElo()[0];
    expect(
      within(rowsOf(table)[0] as HTMLElement).getByText(top?.player ?? ""),
    ).toBeInTheDocument();
    expect(screen.getByText(/Placement-based ELO/)).toBeInTheDocument();
  });
});

describe("/races", () => {
  it("shows titles by race and the matchup tables", () => {
    render(<RacesPage />);
    expect(screen.getByRole("heading", { name: "Titles and representation" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /All stages/ })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /Grand finals only/ })).toBeInTheDocument();
  });
});

describe("/head-to-head", () => {
  it("shows only the form when no players are chosen", async () => {
    render(await HeadToHeadPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("button", { name: "Compare" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the record and every series between two players", async () => {
    render(await HeadToHeadPage({ searchParams: Promise.resolve({ a: "Rush", b: "Soulkey" }) }));
    expect(screen.getByRole("heading", { name: /Rush.*Soulkey/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Seasons both entered" })).toBeInTheDocument();
  });

  it("explains an unknown name", async () => {
    render(await HeadToHeadPage({ searchParams: Promise.resolve({ a: "Flash", b: "Nobody" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent('No ASL player called "Nobody"');
  });

  it("explains picking the same player twice, even by an old spelling", async () => {
    render(await HeadToHeadPage({ searchParams: Promise.resolve({ a: "Best", b: "BeSt" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Pick two different players.");
  });
});
