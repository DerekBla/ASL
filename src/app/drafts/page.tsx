import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";

import { isMarketsEnabled } from "@/lib/config/env";
import { getReadDb } from "@/lib/db/client";
import { PICK_SECONDS } from "@/lib/draft/draft";
import { getViewer } from "@/lib/services/auth";
import { listLeaguesFor } from "@/lib/services/draft";
import { listPickems } from "@/lib/services/pickem";

import { CreateLeagueForm, DraftsOff, LeagueList } from "@/features/draft";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Drafts",
  description: "Draft the season's ASL players with friends, fantasy style.",
};

async function draftsBody(): Promise<ReactElement> {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <p className="notice">
        <Link href={`/sign-in?redirect_url=${encodeURIComponent("/drafts")}`}>Sign in</Link> to
        start a draft or see the ones you are in.
      </p>
    );
  }
  const db = getReadDb();
  const [leagues, pickems] = await Promise.all([
    listLeaguesFor(db, viewer.userId),
    listPickems(db),
  ]);
  const open = pickems.filter((p) => p.status === "open");
  return (
    <>
      <section aria-labelledby="new-heading" className="flex flex-col gap-3">
        <h2 id="new-heading">Start a draft</h2>
        {open.length > 0 ? (
          <CreateLeagueForm seasons={open.map((p) => ({ season: p.season, title: p.title }))} />
        ) : (
          <p className="notice">
            Drafts open when the next season&apos;s players are announced, and close when its first
            match is played.
          </p>
        )}
      </section>
      <section aria-labelledby="mine-heading" className="flex flex-col gap-3">
        <h2 id="mine-heading">Your drafts</h2>
        <LeagueList leagues={leagues} />
      </section>
    </>
  );
}

export default async function DraftsPage(): Promise<ReactElement> {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1>Drafts</h1>
        <p className="text-ink-muted">
          Fantasy ASL. Start a draft, send the invite link to your friends, and take turns picking
          the season&apos;s players in snake order, with {PICK_SECONDS} seconds for each pick. Your
          team scores 1 point for every game its players win, plus 1 bonus point each time one of
          them reaches the round of 8, the round of 4, the final, and wins the title. The best team
          at the end of the season is the Draft champion.
        </p>
      </header>
      {isMarketsEnabled() ? await draftsBody() : <DraftsOff />}
    </div>
  );
}
