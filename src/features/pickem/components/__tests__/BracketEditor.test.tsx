import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Selection } from "@/lib/pickem/types";

import { makePickemConfig, makeResults } from "@/test/factories/pickem";

import { savePicksAction } from "../../actions/save-picks";
import { BracketEditor } from "../BracketEditor";

vi.mock("../../actions/save-picks", () => ({ savePicksAction: vi.fn() }));

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function renderEditor(initialPicks: Selection = {}): void {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <BracketEditor season={23} config={makePickemConfig()} initialPicks={initialPicks} />
    </QueryClientProvider>,
  );
}

function round(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

function pick(roundName: string, player: string): void {
  fireEvent.click(within(round(roundName)).getByRole("button", { name: new RegExp(player) }));
}

beforeEach(() => {
  vi.mocked(savePicksAction).mockReset();
  refresh.mockReset();
});

describe("BracketEditor", () => {
  it("lets two through per group and then closes the group", () => {
    renderEditor();
    pick("Group stage", "Flash");
    pick("Group stage", "Rain");
    const groups = within(round("Group stage"));
    expect(groups.getByRole("button", { name: /Flash/ })).toHaveAttribute("aria-pressed", "true");
    expect(groups.getByRole("button", { name: /Light/ })).toBeDisabled();
    expect(groups.getByRole("button", { name: /Soulkey/ })).toBeEnabled();
    expect(groups.getByText("2 of 4 picked")).toBeInTheDocument();
  });

  it("offers later rounds only the players advanced so far, plus the seeds", () => {
    renderEditor();
    expect(
      within(round("Semifinals")).getByText("Pick the round before this one first."),
    ).toBeInTheDocument();
    pick("Group stage", "Flash");
    const quarters = within(round("Quarterfinals"));
    expect(quarters.getByRole("button", { name: /Flash/ })).toBeInTheDocument();
    expect(quarters.getByRole("button", { name: /soma/ })).toBeInTheDocument();
    expect(quarters.queryByRole("button", { name: /Rain/ })).not.toBeInTheDocument();
  });

  it("drops a player from every later round when they are unpicked", () => {
    renderEditor(makeResults());
    expect(screen.getByText("11 of 11 picks made")).toBeInTheDocument();
    pick("Group stage", "Flash");
    // Flash was in the group stage, quarterfinals and semifinals.
    expect(screen.getByText("8 of 11 picks made")).toBeInTheDocument();
    expect(
      within(round("Semifinals")).queryByRole("button", { name: /Flash/ }),
    ).not.toBeInTheDocument();
  });

  it("saves the bracket and says how much of it is filled in", async () => {
    vi.mocked(savePicksAction).mockResolvedValue({
      data: { entryId: 1, picksMade: 2, totalPicks: 11 },
    });
    renderEditor();
    pick("Group stage", "Flash");
    pick("Quarterfinals", "soma");
    fireEvent.click(screen.getByRole("button", { name: "Save bracket" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Bracket saved with 2 of 11 picks."),
    );
    expect(savePicksAction).toHaveBeenCalledWith({
      season: 23,
      picks: { groups: ["Flash"], ro8: ["soma"] },
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows why a save was refused", async () => {
    vi.mocked(savePicksAction).mockResolvedValue({ error: { code: "PICKEM_LOCKED" } });
    renderEditor(makeResults());
    fireEvent.click(screen.getByRole("button", { name: "Save bracket" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Brackets are locked. The season has started.",
      ),
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
