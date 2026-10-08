import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isMarketsEnabled } from "@/lib/config/env";
import { achievementsFor } from "@/lib/pickem/achievements";
import { picksMade } from "@/lib/pickem/bracket";
import { championOf, scoreEntry } from "@/lib/pickem/scoring";
import type { PickemStatus, Selection } from "@/lib/pickem/types";
import { getViewer } from "@/lib/services/auth";
import { getEntry, getMyEntry, getPickem, getStandings, listPickems } from "@/lib/services/pickem";
import type { EntryView, PickemView, StandingRow } from "@/lib/services/pickem";
import { userId } from "@/lib/types/ids";

import { makePickemConfig, makeResults } from "@/test/factories/pickem";
import { proseDashes, readableText } from "@/test/prose-dashes";

import BracketPage from "../pickem/[season]/brackets/[entryId]/page";
import PickemSeasonPage from "../pickem/[season]/page";
import PickemPage from "../pickem/page";

vi.mock("@/lib/config/env", () => ({ isMarketsEnabled: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getReadDb: () => ({}) }));
vi.mock("@/lib/services/auth", () => ({ getViewer: vi.fn() }));
vi.mock("@/lib/services/pickem", () => ({
  listPickems: vi.fn(),
  getPickem: vi.fn(),
  getStandings: vi.fn(),
  getMyEntry: vi.fn(),
  getEntry: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
// The bracket editor is covered by its own test; it needs a QueryClient the pages get from the layout.
vi.mock("@/features/pickem/hooks/use-save-picks", () => ({
  useSavePicks: () => ({ mutate: vi.fn(), isPending: false }),
}));

const config = makePickemConfig();
const SHARP = userId("user_sharp");

function pickem(status: PickemStatus): PickemView {
  const results = status === "open" ? {} : makeResults();
  return {
    season: 23,
    title: "ASL Season 23 pick'em",
    locksAt: "2027-01-10T10:00:00.000Z",
    status,
    entries: 2,
    champion: championOf(config, results),
    config,
    results,
    resultsNote: status === "open" ? null : "https://liquipedia.net/starcraft/ASL/23",
    gameWins: {},
  };
}

function standing(
  view: PickemView,
  rank: number,
  entryId: number,
  name: string,
  picks: Selection,
): StandingRow {
  const score = scoreEntry(config, view.results, picks);
  return {
    rank,
    entryId,
    userId: `user_${name}`,
    displayName: name,
    picksMade: picksMade(config, picks),
    championPick: view.status === "open" ? null : championOf(config, picks),
    score,
    achievements: achievementsFor(config, view.results, picks, score, {
      rank,
      entries: 2,
      championShare: 0.5,
    }),
  };
}

function entry(view: PickemView, hidden = false): EntryView {
  const row = standing(view, 1, 1, "sharp", makeResults());
  return {
    entryId: 1,
    season: 23,
    userId: SHARP,
    displayName: "sharp",
    updatedAt: "2027-01-09T10:00:00.000Z",
    bracket: hidden
      ? null
      : {
          picks: makeResults(),
          score: row.score,
          rank: 1,
          entries: 2,
          achievements: row.achievements,
        },
  };
}

function use(view: PickemView): void {
  vi.mocked(getPickem).mockResolvedValue(view);
  vi.mocked(getStandings).mockResolvedValue([
    standing(view, 1, 1, "sharp", makeResults()),
    standing(view, 2, 2, "off", { groups: ["Flash", "Light"], ro8: ["Light", "Queen"] }),
  ]);
}

const season = { params: Promise.resolve({ season: "23" }) };
const bracket = { params: Promise.resolve({ season: "23", entryId: "1" }) };

beforeEach(() => {
  vi.mocked(isMarketsEnabled).mockReturnValue(true);
  vi.mocked(getViewer).mockResolvedValue(undefined);
  vi.mocked(getMyEntry).mockResolvedValue(undefined);
});

describe("pick'em pages before the keys are set", () => {
  it.each([
    ["/pickem", () => PickemPage()],
    ["/pickem/[season]", () => PickemSeasonPage(season)],
    ["/pickem/[season]/brackets/[entryId]", () => BracketPage(bracket)],
  ])("%s explains that pick'em is warming up", async (_route, page) => {
    vi.mocked(isMarketsEnabled).mockReturnValue(false);
    const { container } = render(await page());
    expect(screen.getByRole("heading", { name: "Pick'em is warming up" })).toBeInTheDocument();
    expect(proseDashes(readableText(container))).toEqual([]);
  });
});

describe("/pickem", () => {
  it("lists each season's pick'em with its status", async () => {
    vi.mocked(listPickems).mockResolvedValue([
      pickem("open"),
      { ...pickem("complete"), season: 22 },
    ]);
    const { container } = render(await PickemPage());
    const links = screen.getAllByRole("link", { name: "ASL Season 23 pick'em" });
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/pickem/23", "/pickem/22"]);
    expect(screen.getByText(/Open for brackets · locks Jan 10/)).toBeInTheDocument();
    expect(screen.getByText("Finished · won by soma · 2 brackets")).toBeInTheDocument();
    expect(proseDashes(readableText(container))).toEqual([]);
  });
});

describe("/pickem/[season]", () => {
  it("asks a signed out visitor to sign in while brackets are open, and hides everyone's picks", async () => {
    use(pickem("open"));
    const { container } = render(await PickemSeasonPage(season));
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?redirect_url=%2Fpickem%2F23",
    );
    const table = within(screen.getByRole("table"));
    expect(table.getByRole("columnheader", { name: /Picks made/ })).toBeInTheDocument();
    expect(table.getByText("11 of 11")).toBeInTheDocument();
    expect(table.queryByText("soma")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Results so far" })).not.toBeInTheDocument();
    expect(proseDashes(readableText(container))).toEqual([]);
  });

  it("gives a signed in visitor the bracket editor while brackets are open", async () => {
    use(pickem("open"));
    vi.mocked(getViewer).mockResolvedValue({ userId: SHARP, isAdmin: false, created: false });
    render(await PickemSeasonPage(season));
    expect(screen.getByRole("button", { name: "Save bracket" })).toBeInTheDocument();
    expect(screen.getByText("0 of 11 picks made")).toBeInTheDocument();
  });

  it("shows results and ranked standings once the season is decided", async () => {
    const view = pickem("complete");
    use(view);
    vi.mocked(getViewer).mockResolvedValue({ userId: SHARP, isAdmin: false, created: false });
    vi.mocked(getMyEntry).mockResolvedValue(entry(view));
    const { container } = render(await PickemSeasonPage(season));

    expect(screen.getByText(/You are ranked 1 of 2 with 28 points/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See your bracket" })).toHaveAttribute(
      "href",
      "/pickem/23/brackets/1",
    );
    expect(screen.getByRole("heading", { name: "Results so far" })).toBeInTheDocument();

    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("1sharp (you)28100.0%");
    expect(within(rows[1] as HTMLElement).getByText("Season winner")).toBeInTheDocument();
    expect(rows[2]).toHaveTextContent("2off1");
    expect(screen.getByRole("button", { name: /Accuracy/ })).toBeInTheDocument();
    expect(proseDashes(readableText(container))).toEqual([]);
  });
});

describe("/pickem/[season]/brackets/[entryId]", () => {
  it("shows a locked bracket with its score, achievements and marked picks", async () => {
    const view = pickem("complete");
    use(view);
    vi.mocked(getEntry).mockResolvedValue(entry(view));
    const { container } = render(await BracketPage(bracket));

    expect(screen.getByRole("heading", { name: "sharp's bracket" })).toBeInTheDocument();
    expect(screen.getByText("28 of 28")).toBeInTheDocument();
    expect(screen.getByText("Called the champion")).toBeInTheDocument();
    expect(screen.getByText("Perfect bracket")).toBeInTheDocument();
    expect(screen.getAllByText("right").length).toBe(11);
    expect(proseDashes(readableText(container))).toEqual([]);
  });

  it("keeps someone else's bracket hidden until the lock", async () => {
    const view = pickem("open");
    use(view);
    vi.mocked(getEntry).mockResolvedValue(entry(view, true));
    render(await BracketPage(bracket));
    expect(screen.getByText(/hidden until the pick'em locks/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Picks" })).not.toBeInTheDocument();
  });

  it("is not found for a bracket that does not exist", async () => {
    use(pickem("complete"));
    vi.mocked(getEntry).mockResolvedValue(undefined);
    await expect(BracketPage(bracket)).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
