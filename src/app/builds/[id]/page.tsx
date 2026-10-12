import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";

import { getBuildReplay, getBuildReplays } from "@/lib/services/builds";
import type { BuildReplay } from "@/lib/services/builds";

import { BuildReplayDetail } from "@/features/builds";

type Props = {
  params: Promise<{ id: string }>;
};

export const dynamicParams = false;

export function generateStaticParams(): { id: string }[] {
  return getBuildReplays().map((replay) => ({ id: replay.id }));
}

/** "Light vs Rich (TvP)". */
function gameTitle(replay: BuildReplay): string {
  const [subject, opponent] = replay.players;
  const opponentName = opponent?.pro ?? opponent?.name ?? "opponent";
  return `${replay.pro} vs ${opponentName} (${subject?.race ?? ""}v${opponent?.race ?? ""})`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const replay = getBuildReplay((await params).id);
  if (!replay) return {};
  return {
    title: `${gameTitle(replay)} build order`,
    description: `Build orders of both players in ${gameTitle(replay)} on ${replay.map}, with times and supply.`,
  };
}

export default async function BuildReplayPage({ params }: Props): Promise<ReactElement> {
  const replay = getBuildReplay((await params).id);
  if (!replay) notFound();
  return (
    <div className="flex flex-col gap-6">
      <p className="text-caption">
        <Link href="/builds">All build orders</Link>
      </p>
      <h1>{gameTitle(replay)}</h1>
      <BuildReplayDetail replay={replay} />
    </div>
  );
}
