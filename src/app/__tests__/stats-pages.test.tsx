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
    expect(screen.getByRole("heading", { name: "Third place match" })).toBeInTheDocument();
    const placements = screen.getByRole("table", { name: /best finish first/ });
    expect(rowsOf(placements)).toHaveLength(28);
    expect(within(rowsOf(placements)[0] as HTMLElement).getByText("Rain")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /StarCraft League Remastered\/5/ })).toHaveAttribute(
      "href",
      expect.stringContaining("liquipedia.net"),
    );
  });

  it("draws the playoffs as a bracket", async () => {
    render(await SeasonPage({ params: Promise.resolve({ season: "5" }) }));
    const final = screen.getByRole("region", { name: "Final" });
    expect(within(final).getAllByRole("listitem")).toHaveLength(1);
    expect(within(final).getByRole("listitem")).toHaveTextContent("Rainwon3");
    expect(within(final).getByRole("listitem")).toHaveTextContent("SnOw1");
    expect(
      within(screen.getByRole("region", { name: "Quarterfinals" })).getAllByRole("listitem"),
    ).toHaveLength(4);
    expect(
      within(screen.getByRole("region", { name: "Semifinals" })).getAllByRole("listitem"),
    ).toHaveLength(2);
    expect(screen.getByRole("region", { name: "Third place match" })).toHaveTextContent("herO");
    // S5's playoff casts are titled by day, so they are listed under the bracket.
    expect(
      screen.getByRole("link", { name: "Day 1: watch Quarterfinal casts, Day 1 on YouTube" }),
    ).toHaveAttribute("href", expect.stringContaining("youtube.com/watch"));
  });

  it("lists the maps of a playoff series and links its cast", async () => {
    render(await SeasonPage({ params: Promise.resolve({ season: "21" }) }));
    const final = screen.getByRole("region", { name: "Final" });
    expect(within(final).getByText("Show maps")).toBeInTheDocument();
    expect(within(final).getAllByRole("listitem")).toHaveLength(1 + 7);
    const vod = within(final).getByRole("link", {
      name: "VOD: watch soma against Flash on YouTube",
    });
    expect(vod).toHaveAttribute("href", expect.stringContaining("youtube.com/watch"));
    expect(vod).toHaveAttribute("target", "_blank");
  });

  it("shows each group as a table with who advanced, then its matches", async () => {
    render(await SeasonPage({ params: Promise.resolve({ season: "5" }) }));
    const group = screen.getByRole("table", { name: "Round of 24, Group A" });
    const rows = within(group).getAllByRole("row").slice(1);
    expect(rows.map((r) => r.textContent)).toEqual([
      "1.ZZergShine2–0Advanced",
      "2.PProtossShuttle2–1Advanced",
      "3.PProtossSky1–2Out",
      "4.TTerranLight0–2Out",
    ]);
    const matches = screen.getByRole("list", { name: "Round of 24 Group A matches" });
    expect(within(matches).getAllByRole("listitem")).toHaveLength(5);
    expect(within(matches).getByText("Decider match")).toBeInTheDocument();
    // The matches sit in a closed click to expand, each with its map.
    const details = matches.closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(
      within(details as HTMLElement).getByText("Show the 5 matches and maps"),
    ).toBeInTheDocument();
    expect(within(matches).getAllByText("Played on", { exact: false })).toHaveLength(5);
    expect(
      screen.getByRole("link", { name: "VOD: watch Round of 24 Group A on YouTube" }),
    ).toHaveAttribute("href", expect.stringContaining("youtube.com/watch"));
    expect(screen.getByRole("table", { name: "Round of 16, Group D" })).toBeInTheDocument();
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

  it("shows win rates by opponent race and an ELO chart", async () => {
    render(await PlayerPage({ params: Promise.resolve({ slug: "flash" }) }));
    const byRace = screen.getByRole("list", { name: "Series record by opponent race" });
    const items = within(byRace).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    for (const item of items) expect(item.textContent).toMatch(/\d+–\d+\d+\.\d%|no series/);
    expect(screen.getByRole("img", { name: /Flash's ELO after each of/ })).toBeInTheDocument();
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
    const table = screen.getByRole("table", { name: /All players by current ELO/ });
    expect(screen.getByText("Top 10 players over time")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Highlight a player" }).children).toHaveLength(10);
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
    expect(screen.getByText(/ELO from season placements/)).toBeInTheDocument();
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
