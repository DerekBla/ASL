import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  getElo,
  getMaps,
  getPlayers,
  getRecords,
  getSeasons,
  getSeriesForPlayer,
  mapSlug,
} from "@/lib/services/stats";
import { formatElo, formatEloChange } from "@/lib/utils/format";

import EloMatchupsPage from "../elo/matchups/page";
import EloPage from "../elo/page";
import EloWithQualifiersPage from "../elo/with-qualifiers/page";
import HeadToHeadPage from "../head-to-head/page";
import MapPage, { generateStaticParams as mapParams } from "../maps/[slug]/page";
import MapsPage from "../maps/page";
import PlayerPage, { generateStaticParams as playerParams } from "../players/[slug]/page";
import PlayersPage from "../players/page";
import RacesPage from "../races/page";
import RecordsPage from "../records/page";
import SearchPage from "../search/page";
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
    const newest = getSeasons().at(-1)?.season ?? 0;
    expect(
      within(rows[0] as HTMLElement).getByRole("link", { name: new RegExp(`^S${newest} `) }),
    ).toHaveAttribute("href", `/seasons/${newest}`);
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
    // S5's playoff casts are titled by day: each goes to the match of the same number.
    const quarters = screen.getByRole("region", { name: "Quarterfinals" });
    expect(within(quarters).getAllByRole("link", { name: /^VOD: watch/ })).toHaveLength(4);
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

  it("shows a season in progress with its final still to play", async () => {
    const live = getSeasons().find((s) => s.status === "in_progress");
    if (!live) return; // every stored season is finished
    render(await SeasonPage({ params: Promise.resolve({ season: String(live.season) }) }));
    expect(screen.getByText("This season is still in progress.")).toBeInTheDocument();
    const final = within(screen.getByRole("region", { name: "Final" }));
    expect(
      final.getByText(
        /^Not played yet\. The numbers are each player's chance from ELO in a best of 7/,
      ),
    ).toBeInTheDocument();
    for (const side of live.upcoming[0]?.players ?? []) {
      expect(final.getByRole("link", { name: side.player })).toBeInTheDocument();
    }
    expect(final.queryByText("won")).not.toBeInTheDocument();
    const placements = screen.getByRole("table", { name: /best finish first/ });
    expect(within(placements).getAllByText("1st–2nd")).toHaveLength(2);
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
    const byRace = screen.getByRole("table", { name: "Record by opponent race" });
    const items = rowsOf(byRace);
    expect(items).toHaveLength(3);
    // Series record, series win rate, games record, then the rating in that matchup.
    for (const item of items) {
      expect(item.textContent).toMatch(/\d+–\d+\d+\.\d%\d+–\d+\d,\d{3}\.\d$/);
    }
    expect(screen.getByRole("img", { name: /Flash's ELO after each of/ })).toBeInTheDocument();
  });

  it("lists every series with what it did to the ELO, newest first", async () => {
    render(await PlayerPage({ params: Promise.resolve({ slug: "soulkey" }) }));
    const log = screen.getByRole("table", { name: /series, newest first/ });
    const played = getSeriesForPlayer("Soulkey");
    const rows = rowsOf(log);
    expect(rows).toHaveLength(played.length);
    const last = played.at(-1);
    if (!last) throw new Error("expected Soulkey to have played");
    const cells = within(rows[0] as HTMLElement).getAllByRole("cell");
    // The newest series, read from the data so a refreshed season does not break the test.
    const won = last.winner === "Soulkey";
    const before = won ? last.elo.winnerBefore : last.elo.loserBefore;
    const after = won ? last.elo.winnerAfter : last.elo.loserAfter;
    expect(cells[0]).toHaveTextContent(`S${last.season}`);
    expect(cells[2]).toHaveTextContent(won ? last.loser : last.winner);
    expect(cells[4]?.textContent).toMatch(won ? /^Won( \d–\d)?$/ : /^Lost( \d–\d)?$/);
    expect(cells[5]).toHaveTextContent(formatElo(before));
    expect(cells[6]).toHaveTextContent(formatEloChange(after - before));
    expect(cells[7]).toHaveTextContent(formatElo(after));
    // What the table ends on is the rating the ELO page shows.
    expect(after).toBe(getElo().find((r) => r.player === "Soulkey")?.currentElo);
    // A loss shows a real minus sign, not a hyphen.
    expect(within(log).getAllByText(/^−\d+\.\d$/).length).toBeGreaterThan(0);
  });

  it("lists the player's maps with a link to each", async () => {
    render(await PlayerPage({ params: Promise.resolve({ slug: "flash" }) }));
    const maps = screen.getByRole("table", { name: /^Games on \d+ maps/ });
    expect(within(maps).getByRole("link", { name: "Fighting Spirit" })).toHaveAttribute(
      "href",
      "/maps/fighting-spirit",
    );
  });

  it("lists the other spellings of a merged player", async () => {
    render(await PlayerPage({ params: Promise.resolve({ slug: "tulbo" }) }));
    expect(screen.getByText(/Also written as/)).toHaveTextContent("huro");
  });

  it("is a 404 for an unknown player", async () => {
    await expect(PlayerPage({ params: Promise.resolve({ slug: "nobody" }) })).rejects.toThrow();
  });
});

describe("/maps", () => {
  it("lists every map with the three matchups, most played first", () => {
    render(<MapsPage />);
    const table = screen.getByRole("table");
    const rows = rowsOf(table);
    expect(rows).toHaveLength(getMaps().length);
    const top = getMaps()[0];
    if (!top) throw new Error("expected at least one map");
    expect(within(rows[0] as HTMLElement).getByRole("link", { name: top.map })).toHaveAttribute(
      "href",
      `/maps/${mapSlug(top.map)}`,
    );
    for (const header of ["Terran vs Zerg", "Zerg vs Protoss", "Protoss vs Terran"]) {
      expect(within(table).getByRole("columnheader", { name: new RegExp(header) })).toBeVisible();
    }
    expect(rows[0]?.textContent).toMatch(/\d+–\d+ \(\d+\.\d%\)/);
  });

  it("pre-renders a page per map, with race results and every player's record", async () => {
    expect(mapParams()).toHaveLength(getMaps().length);
    render(await MapPage({ params: Promise.resolve({ slug: "eclipse" }) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Eclipse");
    const eclipse = getMaps().find((m) => m.map === "Eclipse");
    const races = screen.getByRole("table", { name: "Games between the races on this map" });
    expect(rowsOf(races)).toHaveLength(6);
    expect(rowsOf(races)[0]?.textContent).toMatch(/Terran won \d+, Zerg won \d+/);
    const players = screen.getByRole("table", { name: /players with a game here/ });
    expect(rowsOf(players)).toHaveLength(eclipse?.players.length ?? 0);
    await expect(MapPage({ params: Promise.resolve({ slug: "nowhere" }) })).rejects.toThrow();
  });
});

describe("/records", () => {
  it("shows streaks, upsets, title runs, ages and career leaders", () => {
    render(<RecordsPage />);
    const records = getRecords();
    const series = screen.getByRole("table", { name: "Most series won in a row" });
    const first = records.seriesStreaks[0];
    expect(rowsOf(series)).toHaveLength(records.seriesStreaks.length);
    expect(rowsOf(series)[0]).toHaveTextContent(`${first?.player}${first?.length}`);
    expect(rowsOf(screen.getByRole("table", { name: "Biggest upsets by ELO gap" }))).toHaveLength(
      records.upsets.length,
    );
    expect(rowsOf(screen.getByRole("table", { name: /Every champion's games/ }))).toHaveLength(
      records.titleRuns.length,
    );
    const youngest = [...records.championAges].sort((a, b) => a.days - b.days)[0];
    expect(rowsOf(screen.getByRole("table", { name: "Youngest champions" }))[0]).toHaveTextContent(
      `${youngest?.player}S${youngest?.season}${youngest?.years} years`,
    );
    const titles = screen.getByRole("region", { name: "Most championships" });
    expect(within(titles).getAllByRole("listitem")).toHaveLength(5);
  });
});

describe("/elo/matchups", () => {
  it("ranks each of the nine matchups and lists every player", () => {
    render(<EloMatchupsPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("ELO by matchup");
    for (const name of ["Terran vs Zerg", "Zerg mirror", "Protoss vs Terran"]) {
      const card = screen.getByRole("region", { name });
      expect(within(card).getAllByRole("listitem").length).toBeGreaterThan(0);
    }
    // Only Zerg players are ranked in a Zerg matchup.
    const zvt = within(screen.getByRole("region", { name: "Zerg vs Terran" }));
    const zergs = new Set(
      getPlayers()
        .filter((p) => p.race === "Z")
        .map((p) => p.player),
    );
    for (const link of zvt.getAllByRole("link"))
      expect(zergs.has(link.textContent ?? "")).toBe(true);
    expect(rowsOf(screen.getByRole("table"))).toHaveLength(getElo().length);
  });
});

describe("/search", () => {
  it("goes straight to the player on an exact name or old spelling", async () => {
    await expect(SearchPage({ searchParams: Promise.resolve({ q: "zero" }) })).rejects.toThrow(
      /NEXT_REDIRECT/,
    );
  });

  it("lists the matches when there are several, and says so when there are none", async () => {
    const { unmount } = render(await SearchPage({ searchParams: Promise.resolve({ q: "so" }) }));
    expect(screen.getByRole("link", { name: "Soulkey" })).toHaveAttribute(
      "href",
      "/players/soulkey",
    );
    expect(screen.getByRole("link", { name: "soma" })).toBeInTheDocument();
    unmount();
    render(await SearchPage({ searchParams: Promise.resolve({ q: "zzzzqq" }) }));
    expect(screen.getByText(/No ASL player matches/)).toBeInTheDocument();
  });
});

describe("/elo", () => {
  it("shows every column in rank order and says the rating comes from games", () => {
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
      "Games",
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
    expect(screen.getByText(/ELO from individual games/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ASL games only" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Including qualifiers" })).toHaveAttribute(
      "href",
      "/elo/with-qualifiers",
    );
  });

  it("rates players on their games, so one bad season does not sink a champion", () => {
    const rank = new Map(getElo().map((r) => [r.player, r.rank]));
    expect(rank.get("Soulkey")).toBeLessThanOrEqual(5);
    expect(rank.get("Flash")).toBeLessThanOrEqual(3);
  });
});

describe("/elo/with-qualifiers", () => {
  it("ranks by the rating that counts qualifier games and says what that adds", () => {
    render(<EloWithQualifiersPage />);
    expect(screen.getByRole("link", { name: "Including qualifiers" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText(/also counts .* qualifier games, from S4 on/)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: /qualifier games included/ });
    const best = [...getElo()].sort((a, b) => a.withQualifiers.rank - b.withQualifiers.rank)[0];
    const first = within(rowsOf(table)[0] as HTMLElement);
    expect(first.getByText(best?.player ?? "")).toBeInTheDocument();
    expect(first.getByText(String(best?.withQualifiers.games))).toBeInTheDocument();
    expect(best?.withQualifiers.games).toBeGreaterThan(best?.games ?? 0);
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
