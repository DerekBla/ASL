import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";

import { ReplayUpload } from "@/features/builds";

export const metadata: Metadata = {
  title: "Build order from your replay",
  description:
    "Open a StarCraft: Brood War replay and get each player's build order, with times and supply. The file stays in your browser.",
};

export default function BuildUploadPage(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-caption">
        <Link href="/builds">All build orders</Link>
      </p>
      <header className="flex flex-col gap-2">
        <h1>Build order from your replay</h1>
        <p className="text-ink-muted">
          Open any Brood War replay, one of your own or one from a site such as cwal.gg, and get
          each player&apos;s build order: what was built, when, and at about what supply. Keep it
          next to the game while you practice.
        </p>
      </header>
      <ReplayUpload />
    </div>
  );
}
