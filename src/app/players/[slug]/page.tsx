import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";

import { getPlayerBySlug, getPlayers, playerSlug } from "@/lib/services/stats";
import { RACE_NAMES } from "@/lib/types/race";

import { PlayerProfile } from "@/features/stats";

import { RaceBadge } from "@/components/RaceBadge";

type Props = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return getPlayers().map((p) => ({ slug: playerSlug(p.player) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const player = getPlayerBySlug((await params).slug);
  if (!player) return {};
  const race = player.race ? `${RACE_NAMES[player.race]} ` : "";
  return {
    title: player.player,
    description: `${player.player}, ${race}player: every ASL season, career stats, ELO and series record.`,
  };
}

export default async function PlayerPage({ params }: Props): Promise<ReactElement> {
  const player = getPlayerBySlug((await params).slug);
  if (!player) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="flex flex-wrap items-center gap-3">
          {player.player}
          <RaceBadge race={player.race} display="name" />
        </h1>
        {player.aliases.length > 0 ? (
          <p className="text-ink-muted">Also written as {player.aliases.join(", ")}.</p>
        ) : null}
      </header>
      <PlayerProfile player={player} />
    </div>
  );
}
