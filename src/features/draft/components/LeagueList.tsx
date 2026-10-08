import Link from "next/link";
import type { ReactElement } from "react";

import type { DraftStatus } from "@/lib/draft/draft";
import type { LeagueSummary } from "@/lib/services/draft";
import { formatSeason } from "@/lib/utils/format";

export const DRAFT_STATUS_LABEL: Record<DraftStatus, string> = {
  lobby: "Waiting to draft",
  drafting: "Drafting now",
  drafted: "Drafted",
};

/** The reader's own draft leagues. */
export function LeagueList({ leagues }: { leagues: readonly LeagueSummary[] }): ReactElement {
  if (leagues.length === 0) return <p className="text-ink-muted">You are not in a draft yet.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {leagues.map((l) => (
        <li key={l.id} className="flex flex-col gap-1 card p-4">
          <Link href={`/drafts/${l.id}`} className="text-heading">
            {l.name}
          </Link>
          <p className="text-caption text-ink-muted">
            {[
              formatSeason(l.season),
              DRAFT_STATUS_LABEL[l.status],
              `${l.members} ${l.members === 1 ? "manager" : "managers"}`,
              l.rank === null ? null : `you are ranked ${l.rank} with ${l.points} points`,
              l.champion ? "Draft champion" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Shown in place of draft pages until the database and sign-in keys are configured. */
export function DraftsOff(): ReactElement {
  return (
    <div className="flex flex-col gap-3 notice px-5 py-4">
      <h2>Drafts are warming up</h2>
      <p>
        Draft the season&apos;s players with your friends, fantasy style. It switches on once the
        site&apos;s database and sign in are connected.
      </p>
      <p>
        Meanwhile, the <Link href="/seasons">stats</Link> pages work.
      </p>
    </div>
  );
}
