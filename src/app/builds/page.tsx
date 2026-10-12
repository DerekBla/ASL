import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";

import { getBuildsInfo } from "@/lib/services/builds";

import { BuildsIndex } from "@/features/builds";

export const metadata: Metadata = {
  title: "Build orders",
  description:
    "Build orders read from recent ladder replays of ASL players, with times and supply, and the replays to download.",
};

export default function BuildsPage(): ReactElement {
  const info = getBuildsInfo();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1>Build orders</h1>
        <p className="text-ink-muted">
          Recent ladder games of ASL players, each with a build order you can follow along with:
          what was built, when, and at about what supply. Open a game for both players&apos; build
          orders, or download the replay to watch it in StarCraft.
        </p>
        <p className="text-caption text-ink-muted">
          Replays come from{" "}
          <a href={info.source.url} rel="noopener noreferrer" target="_blank">
            {info.source.name}
          </a>
          , which also says which ladder accounts belong to which player. These are each
          player&apos;s newest ladder games as their own race. Games shorter than{" "}
          {Math.round(info.minDurationSeconds / 60)} minutes are left out, since someone left at the
          start.
        </p>
        <p>
          <Link href="/builds/upload" className="font-medium">
            Get the build order from a replay of your own
          </Link>
        </p>
      </header>
      <BuildsIndex />
    </div>
  );
}
