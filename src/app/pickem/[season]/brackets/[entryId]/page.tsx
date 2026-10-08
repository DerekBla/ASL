import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";

import { isMarketsEnabled } from "@/lib/config/env";
import { getReadDb } from "@/lib/db/client";
import { maxPoints } from "@/lib/pickem/bracket";
import { getViewer } from "@/lib/services/auth";
import { getEntry, getPickem } from "@/lib/services/pickem";
import { pickemEntryId } from "@/lib/types/ids";
import { formatPercent } from "@/lib/utils/format";

import { AchievementList, BracketView, PickemOff } from "@/features/pickem";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Bracket" };

type Props = {
  params: Promise<{ season: string; entryId: string }>;
};

function toId(raw: string): number | undefined {
  return /^\d{1,12}$/.test(raw) && Number(raw) > 0 ? Number(raw) : undefined;
}

export default async function BracketPage({ params }: Props): Promise<ReactElement> {
  if (!isMarketsEnabled()) return <PickemOff />;
  const raw = await params;
  const season = toId(raw.season);
  const id = toId(raw.entryId);
  if (season === undefined || id === undefined) notFound();
  const db = getReadDb();
  const pickem = await getPickem(db, season);
  if (!pickem) notFound();
  const viewer = await getViewer();
  const entry = await getEntry(db, pickem, pickemEntryId(id), viewer?.userId);
  if (!entry) notFound();

  const bracket = entry.bracket;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <nav aria-label="Breadcrumb" className="text-caption">
          <Link href={`/pickem/${season}`}>{pickem.title}</Link>
        </nav>
        <h1>{entry.displayName}&apos;s bracket</h1>
      </header>
      {bracket === null ? (
        <p className="notice">
          This bracket is hidden until the pick&apos;em locks. After that every bracket is public.
        </p>
      ) : (
        <>
          {pickem.status === "open" ? (
            <p className="notice">
              Only you can see this until the pick&apos;em locks.{" "}
              <Link href={`/pickem/${season}`}>Change your picks</Link>
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="stat">
                <dt className="text-caption text-ink-muted">Rank</dt>
                <dd className="text-heading">
                  {bracket.rank} of {bracket.entries}
                </dd>
              </div>
              <div className="stat">
                <dt className="text-caption text-ink-muted">Points</dt>
                <dd className="text-heading">
                  {bracket.score.points} of {maxPoints(pickem.config)}
                </dd>
              </div>
              <div className="stat">
                <dt className="text-caption text-ink-muted">Accuracy</dt>
                <dd className="text-heading">{formatPercent(bracket.score.accuracy)}</dd>
              </div>
              <div className="stat">
                <dt className="text-caption text-ink-muted">Best possible</dt>
                <dd className="text-heading">{bracket.score.possible}</dd>
              </div>
            </dl>
          )}
          {bracket.achievements.length > 0 ? (
            <section aria-labelledby="achievements-heading" className="flex flex-col gap-3">
              <h2 id="achievements-heading">Achievements</h2>
              <AchievementList achievements={bracket.achievements} />
            </section>
          ) : null}
          <section aria-labelledby="picks-heading" className="flex flex-col gap-3">
            <h2 id="picks-heading">Picks</h2>
            <BracketView
              config={pickem.config}
              selection={bracket.picks}
              {...(pickem.status === "open" ? {} : { score: bracket.score })}
              empty="No pick made."
            />
          </section>
        </>
      )}
    </div>
  );
}
