import type { ReactElement } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { teamStandings } from "@/lib/draft/draft";

import { makeDraftingLeague, makeLeagueView } from "@/test/factories/draft";
import { makeGameWins, makePickemConfig, makeResults } from "@/test/factories/pickem";

import { makePickAction, startDraftAction } from "../../actions/draft";
import { LeagueLive } from "../LeagueLive";

vi.mock("../../actions/draft", () => ({ makePickAction: vi.fn(), startDraftAction: vi.fn() }));

function renderLeague(ui: ReactElement): void {
  // The page polls /api/drafts/[id]; in tests the first render's data is all there is.
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no network in tests")));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.mocked(makePickAction).mockReset();
  vi.mocked(startDraftAction).mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lobby", () => {
  it("lets the owner choose a team size that fits and start the draft", async () => {
    vi.mocked(startDraftAction).mockResolvedValue({ data: { started: true } });
    renderLeague(<LeagueLive initial={makeLeagueView()} viewerId="user_ann" />);

    const size = screen.getByLabelText("Players on each team");
    // 12 players, 2 managers: up to 6 each, and the biggest is the default.
    expect(within(size).getAllByRole("option")).toHaveLength(6);
    expect(size).toHaveValue("6");
    fireEvent.change(size, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Start the draft" }));
    await waitFor(() =>
      expect(startDraftAction).toHaveBeenCalledWith({ leagueId: 7, teamSize: 3 }),
    );
  });

  it("shows members the invite link, and other managers no start button", () => {
    renderLeague(<LeagueLive initial={makeLeagueView()} viewerId="user_bo" />);
    expect(screen.getByLabelText(/Invite link/)).toHaveValue(
      `${window.location.origin}/drafts/join/invitecode12`,
    );
    expect(screen.getByText("Ann (runs the draft)")).toBeInTheDocument();
    expect(screen.getByText("Bo (you)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start the draft" })).not.toBeInTheDocument();
  });

  it("will not start with one person", () => {
    const alone = makeLeagueView({ members: [{ userId: "user_ann", displayName: "Ann" }] });
    renderLeague(<LeagueLive initial={alone} viewerId="user_ann" />);
    expect(screen.getByRole("button", { name: "Start the draft" })).toBeDisabled();
    expect(screen.getByText("Invite at least one more person first.")).toBeInTheDocument();
  });
});

describe("draft room", () => {
  it("lets the manager on the clock draft a player who is still free", async () => {
    vi.mocked(makePickAction).mockResolvedValue({ data: { pickNo: 1, drafted: false } });
    renderLeague(<LeagueLive initial={makeDraftingLeague()} viewerId="user_bo" />);

    expect(screen.getByRole("status")).toHaveTextContent("Your pick. Pick 2 of 4, round 1 of 2.");
    expect(screen.queryByRole("button", { name: "Draft soma" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Draft Flash" }));
    await waitFor(() =>
      expect(makePickAction).toHaveBeenCalledWith({ leagueId: 7, player: "Flash" }),
    );
  });

  it("shows everyone else who is picking and keeps the players locked", () => {
    renderLeague(<LeagueLive initial={makeDraftingLeague()} viewerId="user_ann" />);
    expect(screen.getByRole("status")).toHaveTextContent("Bo is picking.");
    expect(screen.getByRole("button", { name: "Draft Flash" })).toBeDisabled();
    expect(screen.getByLabelText(/seconds left/)).toBeInTheDocument();
  });

  it("says why a pick was refused", async () => {
    vi.mocked(makePickAction).mockResolvedValue({ error: { code: "PLAYER_TAKEN" } });
    renderLeague(<LeagueLive initial={makeDraftingLeague()} viewerId="user_bo" />);
    fireEvent.click(screen.getByRole("button", { name: "Draft Flash" }));
    expect(await screen.findByText("That player is already on a team.")).toBeInTheDocument();
  });
});

describe("standings", () => {
  it("ranks the teams by game wins and names the Draft champion when the season is over", () => {
    const picks = [
      { pickNo: 0, userId: "user_ann", player: "soma", auto: false },
      { pickNo: 1, userId: "user_bo", player: "Flash", auto: true },
      { pickNo: 2, userId: "user_bo", player: "Soulkey", auto: false },
      { pickNo: 3, userId: "user_ann", player: "Mini", auto: false },
    ];
    const base = makeLeagueView();
    const league = makeLeagueView({
      status: "drafted",
      teamSize: 2,
      seasonStarted: true,
      seasonComplete: true,
      picks,
      standings: teamStandings(
        makePickemConfig(),
        makeResults(),
        makeGameWins(),
        base.members,
        picks,
      ),
    });
    renderLeague(<LeagueLive initial={league} viewerId="user_ann" />);

    const teams = screen.getAllByRole("listitem").filter((li) => li.querySelector("h3"));
    expect(teams[0]).toHaveTextContent("1. Bo12 pointsDraft champion");
    expect(teams[1]).toHaveTextContent("2. Ann (you)9 points");
    expect(within(teams[1] as HTMLElement).getByText("(out)")).toBeInTheDocument();
    expect(screen.getByText("Bo: Flash (picked by the clock)")).toBeInTheDocument();
    expect(screen.getByText(/these standings are final/)).toBeInTheDocument();
  });
});
