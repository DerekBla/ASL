import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";

import { getSeason, getSeasons } from "@/lib/services/stats";
import { formatScore, formatSeason } from "@/lib/utils/format";

import { PlayerLink, SeasonDetail } from "@/features/stats";

import { RaceBadge } from "@/components/RaceBadge";

type Props = {
  params: Promise<{ season: string }>;
};

export const dynamicParams = false;

export function generateStaticParams(): { season: string }[] {
  return getSeasons().map((s) => ({ season: String(s.season) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const season = getSeason(Number((await params).season));
  if (!season) return {};
  return {
    title: `${formatSeason(season.season)} · ${season.name}`,
    description: season.winner
      ? `${season.name}: ${season.winner} beat ${season.runnerUp} ${formatScore(season.finalScore)} in the final.`
      : `${season.name} results.`,
  };
}

export default async function SeasonPage({ params }: Props): Promise<ReactElement> {
  const season = getSeason(Number((await params).season));
  if (!season) notFound();
  const prev = getSeason(season.season - 1);
  const next = getSeason(season.season + 1);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Seasons" className="flex justify-between text-caption">
        {prev ? (
          <Link href={`/seasons/${prev.season}`}>← {formatSeason(prev.season)}</Link>
        ) : (
          <span />
        )}
        <Link href="/seasons">All seasons</Link>
        {next ? (
          <Link href={`/seasons/${next.season}`}>{formatSeason(next.season)} →</Link>
        ) : (
          <span />
        )}
      </nav>
      <header className="flex flex-col gap-2">
        <h1>{season.name}</h1>
        {season.winner ? (
          <p className="flex flex-wrap items-center gap-2 text-heading">
            <span>Champion</span>
            <RaceBadge race={season.winnerRace} />
            <PlayerLink name={season.winner} />
            <span className="text-ink-muted">beat</span>
            <RaceBadge race={season.runnerUpRace} />
            {season.runnerUp ? <PlayerLink name={season.runnerUp} /> : null}
            <span className="tabular-nums">{formatScore(season.finalScore)}</span>
          </p>
        ) : (
          <p className="text-ink-muted">This season is still in progress.</p>
        )}
      </header>
      <SeasonDetail season={season} />
    </div>
  );
}
