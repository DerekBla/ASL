import { describe, expect, it } from "vitest";

import {
  formatDateRange,
  formatElo,
  formatKrw,
  formatPercent,
  formatScore,
  formatSeason,
} from "../format";
import { playerSlug } from "../slug";

describe("format", () => {
  it("formats won, ELO, percentages and scores", () => {
    expect(formatKrw(78_000_000)).toBe("₩78,000,000");
    expect(formatKrw(null)).toBe("–");
    expect(formatElo(2181.94)).toBe("2,181.9");
    expect(formatElo(1500)).toBe("1,500.0");
    expect(formatPercent(0.52333)).toBe("52.3%");
    expect(formatPercent(null)).toBe("–");
    expect(formatScore("4-3")).toBe("4–3");
    expect(formatScore(null)).toBe("");
    expect(formatSeason(21)).toBe("S21");
  });

  it("formats date ranges in and across years", () => {
    expect(formatDateRange("2026-03-23", "2026-05-24")).toBe("Mar 23 – May 24, 2026");
    expect(formatDateRange("2016-11-26", "2017-01-22")).toBe("Nov 26, 2016 – Jan 22, 2017");
  });
});

describe("playerSlug", () => {
  it("lowercases and hyphenates", () => {
    expect(playerSlug("SnOw")).toBe("snow");
    expect(playerSlug("force(Name)")).toBe("force-name");
    expect(playerSlug("815")).toBe("815");
    expect(playerSlug("  Neo.G_Soulkey ")).toBe("neo-g-soulkey");
  });
});
