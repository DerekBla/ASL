import type { ReactElement } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isMarketsEnabled } from "@/lib/config/env";
import { getViewer } from "@/lib/services/auth";
import { getInvite, listLeaguesFor } from "@/lib/services/draft";
import { readLeague } from "@/lib/services/draft/live";
import { listPickems } from "@/lib/services/pickem";
import { userId } from "@/lib/types/ids";

import { makeDraftingLeague, makeLeagueView } from "@/test/factories/draft";
import { proseDashes, readableText } from "@/test/prose-dashes";

import DraftLeaguePage from "../drafts/[id]/page";
import JoinDraftPage from "../drafts/join/[code]/page";
import DraftsPage from "../drafts/page";

vi.mock("@/lib/config/env", () => ({ isMarketsEnabled: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getReadDb: () => ({}) }));
vi.mock("@/lib/services/auth", () => ({ getViewer: vi.fn() }));
vi.mock("@/lib/services/draft", () => ({ getInvite: vi.fn(), listLeaguesFor: vi.fn() }));
vi.mock("@/lib/services/draft/live", () => ({ readLeague: vi.fn() }));
vi.mock("@/lib/services/pickem", () => ({ listPickems: vi.fn() }));
vi.mock("@/features/draft/actions/draft", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const BO = { userId: userId("user_bo"), isAdmin: false, created: false };
const league = { params: Promise.resolve({ id: "7" }) };
const join = { params: Promise.resolve({ code: "invitecode12" }) };

function renderPage(page: ReactElement): HTMLElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{page}</QueryClientProvider>).container;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no network in tests")));
  vi.mocked(isMarketsEnabled).mockReturnValue(true);
  vi.mocked(getViewer).mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("draft pages before the keys are set", () => {
  it.each([
    ["/drafts", () => DraftsPage()],
    ["/drafts/[id]", () => DraftLeaguePage(league)],
    ["/drafts/join/[code]", () => JoinDraftPage(join)],
  ])("%s explains that drafts are warming up", async (_route, page) => {
    vi.mocked(isMarketsEnabled).mockReturnValue(false);
    const container = renderPage(await page());
    expect(screen.getByRole("heading", { name: "Drafts are warming up" })).toBeInTheDocument();
    expect(proseDashes(readableText(container))).toEqual([]);
  });
});

describe("/drafts", () => {
  it("asks a signed out visitor to sign in", async () => {
    renderPage(await DraftsPage());
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?redirect_url=%2Fdrafts",
    );
  });

  it("offers a new draft for an open season and lists the reader's drafts", async () => {
    vi.mocked(getViewer).mockResolvedValue(BO);
    vi.mocked(listPickems).mockResolvedValue([
      {
        season: 23,
        title: "ASL Season 23 pick'em",
        locksAt: "2027-01-10T10:00:00.000Z",
        status: "open",
        entries: 0,
        champion: null,
      },
    ]);
    vi.mocked(listLeaguesFor).mockResolvedValue([
      {
        id: 7,
        name: "ASL Boys",
        season: 23,
        status: "drafted",
        members: 4,
        rank: 1,
        points: 31,
        champion: true,
      },
    ]);
    const container = renderPage(await DraftsPage());
    expect(screen.getByRole("form", { name: "Start a draft" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ASL Boys" })).toHaveAttribute("href", "/drafts/7");
    expect(
      screen.getByText(
        "S23 · Drafted · 4 managers · you are ranked 1 with 31 points · Draft champion",
      ),
    ).toBeInTheDocument();
    expect(proseDashes(readableText(container))).toEqual([]);
  });

  it("says when no season is open for drafting", async () => {
    vi.mocked(getViewer).mockResolvedValue(BO);
    vi.mocked(listPickems).mockResolvedValue([]);
    vi.mocked(listLeaguesFor).mockResolvedValue([]);
    renderPage(await DraftsPage());
    expect(screen.getByText(/Drafts open when the next season's players/)).toBeInTheDocument();
    expect(screen.getByText("You are not in a draft yet.")).toBeInTheDocument();
  });
});

describe("/drafts/[id]", () => {
  it("shows a live draft to anyone, with copy free of prose dashes", async () => {
    vi.mocked(readLeague).mockResolvedValue(makeDraftingLeague({ code: null }));
    const container = renderPage(await DraftLeaguePage(league));
    expect(screen.getByRole("heading", { name: "ASL Boys" })).toBeInTheDocument();
    expect(
      screen.getByText("ASL Season 23 · Drafting now · 2 managers · 2 players each"),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Bo is picking.");
    expect(proseDashes(readableText(container))).toEqual([]);
  });

  it("is not found for a league that does not exist", async () => {
    vi.mocked(readLeague).mockResolvedValue(undefined);
    await expect(DraftLeaguePage(league)).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("/drafts/join/[code]", () => {
  const invite = { ...makeLeagueView(), members: [{ userId: "user_ann", displayName: "Ann" }] };

  it("offers a signed in visitor the join button", async () => {
    vi.mocked(getViewer).mockResolvedValue(BO);
    vi.mocked(getInvite).mockResolvedValue(invite);
    const container = renderPage(await JoinDraftPage(join));
    expect(screen.getByRole("heading", { name: "Join ASL Boys" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join this draft" })).toBeInTheDocument();
    expect(proseDashes(readableText(container))).toEqual([]);
  });

  it("sends a signed out visitor to sign in and back", async () => {
    vi.mocked(getInvite).mockResolvedValue(invite);
    renderPage(await JoinDraftPage(join));
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?redirect_url=%2Fdrafts%2Fjoin%2Finvitecode12",
    );
  });

  it("turns away latecomers once the draft has started", async () => {
    vi.mocked(getViewer).mockResolvedValue(BO);
    vi.mocked(getInvite).mockResolvedValue({ ...invite, status: "drafting" });
    renderPage(await JoinDraftPage(join));
    expect(screen.getByText(/already started, so nobody new can join/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join this draft" })).not.toBeInTheDocument();
  });
});
