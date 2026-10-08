import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";

import { isMarketsEnabled } from "@/lib/config/env";
import { getReadDb } from "@/lib/db/client";
import { getViewer } from "@/lib/services/auth";
import { getMyEntry, getPickem, getStandings } from "@/lib/services/pickem";

import {
  BracketEditor,
  BracketView,
  PickemOff,
  pickemStatusLine,
  StandingsTable,
} from "@/features/pickem";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ season: string }>;
};

function toSeason(raw: string): number | undefined {
  return /^\d{1,4}$/.test(raw) && Number(raw) > 0 ? Number(raw) : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const season = toSeason((await params).season);
  if (!isMarketsEnabled() || season === undefined) return { title: "Pick'em" };
  const pickem = await getPickem(getReadDb(), season);
  return pickem ? { title: pickem.title } : {};
}

export default async function PickemSeasonPage({ params }: Props): Promise<ReactElement> {
  if (!isMarketsEnabled()) return <PickemOff />;
  const season = toSeason((await params).season);
  if (season === undefined) notFound();
  const db = getReadDb();
  const pickem = await getPickem(db, season);
  if (!pickem) notFound();

  const viewer = await getViewer();
  const [standings, mine] = await Promise.all([
    getStandings(db, pickem),
    viewer ? getMyEntry(db, pickem, viewer.userId) : undefined,
  ]);
  const open = pickem.status === "open";
  const here = `/pickem/${season}`;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <nav aria-label="Breadcrumb" className="text-caption">
          <Link href="/pickem">All pick&apos;ems</Link>
        </nav>
        <h1>{pickem.title}</h1>
        <p className="text-ink-muted">{pickemStatusLine(pickem)}</p>
      </header>

      <section aria-labelledby="mine-heading" className="flex flex-col gap-3">
        <h2 id="mine-heading">Your bracket</h2>
        {open ? (
          viewer ? (
            <BracketEditor
              season={season}
              config={pickem.config}
              initialPicks={mine?.bracket?.picks ?? {}}
            />
          ) : (
            <p className="notice">
              <Link href={`/sign-in?redirect_url=${encodeURIComponent(here)}`}>Sign in</Link> to
              fill out a bracket. Start with the first round and work down to the champion; later
              rounds are worth more.
            </p>
          )
        ) : mine ? (
          <p>
            You are ranked {mine.bracket?.rank} of {mine.bracket?.entries} with{" "}
            {mine.bracket?.score.points} points.{" "}
            <Link href={`${here}/brackets/${mine.entryId}`}>See your bracket</Link>
          </p>
        ) : (
          <p className="text-ink-muted">
            Brackets locked when the season started
            {viewer ? ", and you did not enter this one." : "."}
          </p>
        )}
      </section>

      {open ? null : (
        <section aria-labelledby="results-heading" className="flex flex-col gap-3">
          <h2 id="results-heading">Results so far</h2>
          <BracketView config={pickem.config} selection={pickem.results} empty="Not played yet." />
          {pickem.resultsNote ? (
            <p className="text-caption text-ink-muted">Source: {pickem.resultsNote}</p>
          ) : null}
        </section>
      )}

      <section aria-labelledby="standings-heading" className="flex flex-col gap-3">
        <h2 id="standings-heading">{open ? "Who is in" : "Standings"}</h2>
        <StandingsTable pickem={pickem} rows={standings} viewerId={viewer?.userId} />
      </section>
    </div>
  );
}
