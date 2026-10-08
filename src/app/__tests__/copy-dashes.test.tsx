import type { ReactElement } from "react";

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { proseDashes, readableText } from "@/test/prose-dashes";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

import EloPage from "../elo/page";
import HeadToHeadPage from "../head-to-head/page";
import MarketsPage from "../markets/page";
import HomePage from "../page";
import PlayerPage from "../players/[slug]/page";
import PlayersPage from "../players/page";
import RacesPage from "../races/page";
import SeasonPage from "../seasons/[season]/page";
import SeasonsPage from "../seasons/page";

vi.mock("@/lib/db/client", () => ({
  getReadDb: () => {
    throw new Error("no database in tests");
  },
  withWriteDb: () => {
    throw new Error("no database in tests");
  },
}));

describe("proseDashes", () => {
  it("allows number notation and flags dashes in sentences", () => {
    expect(
      proseDashes("soma beat Flash 4–3 · 9th–12th · 16–2 · Mar 23 – May 24, 2026 · ₩1,000–2,000"),
    ).toEqual([]);
    expect(proseDashes("Licensed under CC-BY-SA 3.0. Series W–L")).toEqual([]);
    expect(proseDashes("Head-to-head")).toHaveLength(1);
    expect(proseDashes("Prices move — fast")).toHaveLength(1);
    expect(proseDashes("a play - money site")).toHaveLength(1);
  });
});

describe("site copy has no dashes in ordinary sentences", () => {
  const pages: [string, () => ReactElement | Promise<ReactElement>][] = [
    [
      "header and footer",
      () => (
        <>
          <SiteHeader />
          <SiteFooter />
        </>
      ),
    ],
    ["/", () => HomePage()],
    ["/seasons", () => SeasonsPage()],
    ["/seasons/1", () => SeasonPage({ params: Promise.resolve({ season: "1" }) })],
    ["/seasons/21", () => SeasonPage({ params: Promise.resolve({ season: "21" }) })],
    ["/players", () => PlayersPage()],
    ["/players/flash", () => PlayerPage({ params: Promise.resolve({ slug: "flash" }) })],
    ["/elo", () => EloPage()],
    ["/races", () => RacesPage()],
    [
      "/head-to-head",
      () => HeadToHeadPage({ searchParams: Promise.resolve({ a: "Rush", b: "Soulkey" }) }),
    ],
    ["/markets (switched off)", () => MarketsPage()],
  ];

  it.each(pages)("%s", async (_name, page) => {
    const { container } = render(await page());
    expect(proseDashes(readableText(container))).toEqual([]);
  });
});
