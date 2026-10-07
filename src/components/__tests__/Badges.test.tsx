import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlacementBadge } from "@/components/PlacementBadge";
import { RaceBadge } from "@/components/RaceBadge";

describe("RaceBadge", () => {
  it("shows the letter and reads out the race name", () => {
    render(<RaceBadge race="Z" />);
    expect(screen.getByText("Z")).toBeInTheDocument();
    expect(screen.getByText("Zerg")).toHaveClass("sr-only");
  });

  it("shows the full name when asked", () => {
    render(<RaceBadge race="P" display="name" />);
    expect(screen.getByText("Protoss")).toBeVisible();
  });

  it("uses pale race colors by default and dark ones for headers", () => {
    const { rerender } = render(<RaceBadge race="T" />);
    expect(screen.getByTitle("Terran")).toHaveClass("bg-race-terran-pale");
    rerender(<RaceBadge race="T" tone="dark" />);
    expect(screen.getByTitle("Terran")).toHaveClass("bg-race-terran-dark");
  });

  it("marks an unknown race instead of guessing", () => {
    render(<RaceBadge race={null} />);
    expect(screen.getByTitle("Race unknown")).toHaveTextContent("?");
  });
});

describe("PlacementBadge", () => {
  it("shows the label it is given", () => {
    render(<PlacementBadge placement={{ label: "9th–12th", best: 9, worst: 12 }} />);
    expect(screen.getByText("9th–12th")).toBeInTheDocument();
  });

  it("gives champions, finalists and semifinalists medal colors", () => {
    render(
      <>
        <PlacementBadge placement={{ label: "1st", best: 1, worst: 1 }} />
        <PlacementBadge placement={{ label: "2nd", best: 2, worst: 2 }} />
        <PlacementBadge placement={{ label: "3rd", best: 3, worst: 3 }} />
      </>,
    );
    expect(screen.getByText("1st")).toHaveClass("bg-medal-gold");
    expect(screen.getByText("2nd")).toHaveClass("bg-medal-silver");
    expect(screen.getByText("3rd")).toHaveClass("bg-medal-bronze");
  });
});
