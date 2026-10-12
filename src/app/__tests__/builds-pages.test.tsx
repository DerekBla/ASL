import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { formatFrame } from "@/lib/replay/buildOrder";
import { getBuildReplays, getBuildReplaysByPro } from "@/lib/services/builds";

import { proseDashes } from "@/test/prose-dashes";

import BuildReplayPage, { generateStaticParams } from "../builds/[id]/page";
import BuildsPage from "../builds/page";

describe("/builds", () => {
  it("lists every stored replay under its pro, with a build order link and a download", () => {
    render(<BuildsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Build orders" })).toBeInTheDocument();
    for (const group of getBuildReplaysByPro()) {
      const table = screen.getByRole("table", { name: `Recent ladder games of ${group.pro}` });
      const rows = within(table).getAllByRole("row").slice(1);
      expect(rows).toHaveLength(group.replays.length);
      const first = group.replays[0];
      const row = rows[0] as HTMLElement;
      expect(within(row).getByRole("link", { name: "Open" })).toHaveAttribute(
        "href",
        `/builds/${first?.id}`,
      );
      expect(within(row).getByRole("link", { name: "Download" })).toHaveAttribute(
        "href",
        first?.file,
      );
    }
  });

  it("credits cwal.gg and uses no dashes in its own copy", () => {
    const { container } = render(<BuildsPage />);
    expect(screen.getByRole("link", { name: "cwal.gg" })).toHaveAttribute(
      "href",
      "https://cwal.gg",
    );
    const intro = container.querySelector("header")?.textContent ?? "";
    expect(proseDashes(intro)).toEqual([]);
  });
});

describe("/builds/[id]", () => {
  it("has a page for every stored replay", () => {
    expect(generateStaticParams()).toEqual(getBuildReplays().map((r) => ({ id: r.id })));
  });

  it("shows both build orders with time and supply, and says supply is a rough guide", async () => {
    const replay = getBuildReplays()[0];
    if (!replay) throw new Error("no replays");
    render(await BuildReplayPage({ params: Promise.resolve({ id: replay.id }) }));

    expect(screen.getByText(/Supply is a rough guide/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download the replay" })).toHaveAttribute(
      "href",
      replay.file,
    );
    for (const player of replay.players) {
      const section = screen.getByRole("region", { name: `Build order of ${player.name}` });
      const rows = within(section).getAllByRole("row").slice(1);
      expect(rows).toHaveLength(player.steps.length);
      const step = player.steps[0];
      const cells = within(rows[0] as HTMLElement).getAllByRole("cell");
      expect(cells[0]).toHaveTextContent(formatFrame(step?.frame ?? 0));
      expect(cells[1]).toHaveTextContent(String(step?.supply));
      expect(cells[2]).toHaveTextContent(step?.name ?? "");
    }
  });
});
