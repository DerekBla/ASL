import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";

import { isMarketsEnabled } from "@/lib/config/env";
import { getViewer } from "@/lib/services/auth";
import { readLeague } from "@/lib/services/draft/live";
import { draftLeagueId } from "@/lib/types/ids";

import { DRAFT_STATUS_LABEL, DraftsOff, LeagueLive } from "@/features/draft";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Draft" };

type Props = {
  params: Promise<{ id: string }>;
};

export default async function DraftLeaguePage({ params }: Props): Promise<ReactElement> {
  if (!isMarketsEnabled()) return <DraftsOff />;
  const raw = (await params).id;
  if (!/^\d{1,12}$/.test(raw) || Number(raw) <= 0) notFound();
  const viewer = await getViewer();
  const league = await readLeague(draftLeagueId(Number(raw)), viewer?.userId);
  if (!league) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <nav aria-label="Breadcrumb" className="text-caption">
          <Link href="/drafts">All drafts</Link>
        </nav>
        <h1>{league.name}</h1>
        <p className="text-ink-muted">
          {league.seasonTitle.replace(/ pick'em$/i, "")} · {DRAFT_STATUS_LABEL[league.status]} ·{" "}
          {league.members.length} {league.members.length === 1 ? "manager" : "managers"}
          {league.teamSize ? ` · ${league.teamSize} players each` : ""}
        </p>
      </header>
      <LeagueLive initial={league} viewerId={viewer?.userId} />
    </div>
  );
}
