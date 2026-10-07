import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/SiteFooter";

describe("SiteFooter", () => {
  it("says the site is an unofficial fan project", () => {
    render(<SiteFooter />);
    expect(screen.getByText(/unofficial fan project/i)).toBeInTheDocument();
    expect(screen.getByText(/not affiliated/i)).toBeInTheDocument();
  });

  it("says minerals are play money with no monetary value", () => {
    render(<SiteFooter />);
    expect(screen.getByText(/play-money minerals only/i)).toBeInTheDocument();
    expect(screen.getByText(/no monetary value/i)).toBeInTheDocument();
  });

  it("credits Liquipedia and links its license", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "Liquipedia" })).toHaveAttribute(
      "href",
      "https://liquipedia.net/starcraft/",
    );
    expect(screen.getByRole("link", { name: "CC-BY-SA 3.0" })).toBeInTheDocument();
  });
});
