import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { readEnv, isAuthEnabled, isMarketsEnabled } from "@/lib/config/env";

import AdminPage from "../admin/page";
import LeaderboardPage from "../leaderboard/page";
import MarketPage from "../markets/[slug]/page";
import MarketsPage from "../markets/page";
import PortfolioPage from "../portfolio/page";

vi.mock("@/lib/db/client", () => ({
  getReadDb: () => {
    throw new Error("no database without keys");
  },
  withWriteDb: () => {
    throw new Error("no database without keys");
  },
}));

describe("environment switches", () => {
  it("turns markets on only with a database and both Clerk keys", () => {
    const db = "postgres://user:pass@host/db";
    expect(isMarketsEnabled(readEnv({}))).toBe(false);
    expect(isMarketsEnabled(readEnv({ DATABASE_URL: db }))).toBe(false);
    const all = {
      DATABASE_URL: db,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_x",
      CLERK_SECRET_KEY: "sk_test_x",
    };
    expect(isAuthEnabled(readEnv(all))).toBe(true);
    expect(isMarketsEnabled(readEnv(all))).toBe(true);
    expect(isMarketsEnabled(readEnv({ ...all, DATABASE_URL: "  " }))).toBe(false);
  });

  it("rejects a malformed database URL", () => {
    expect(() => readEnv({ DATABASE_URL: "not a url" })).toThrow(/DATABASE_URL/);
  });
});

describe("market pages before the keys are set", () => {
  it.each([
    ["/markets", () => MarketsPage()],
    ["/markets/[slug]", () => MarketPage({ params: Promise.resolve({ slug: "anything" }) })],
    ["/leaderboard", () => LeaderboardPage()],
    ["/portfolio", () => PortfolioPage()],
    ["/admin", () => AdminPage()],
  ])("%s explains that markets are warming up", async (_route, page) => {
    render(await page());
    expect(screen.getByRole("heading", { name: "Markets are warming up" })).toBeInTheDocument();
  });
});
