import Link from "next/link";
import type { ReactElement } from "react";

import type { PickemStatus } from "@/lib/pickem/types";
import type { PickemSummary } from "@/lib/services/pickem";
import { formatKoreaTime } from "@/lib/utils/format";

export const STATUS_LABEL: Record<PickemStatus, string> = {
  open: "Open for brackets",
  live: "Locked, season under way",
  complete: "Finished",
};

export function pickemStatusLine(pickem: PickemSummary): string {
  const brackets = pickem.entries === 1 ? "1 bracket" : `${pickem.entries} brackets`;
  const when =
    pickem.status === "open"
      ? `locks ${formatKoreaTime(pickem.locksAt)}`
      : pickem.status === "complete" && pickem.champion
        ? `won by ${pickem.champion}`
        : null;
  return [STATUS_LABEL[pickem.status], when, brackets].filter(Boolean).join(" · ");
}

export function PickemList({ pickems }: { pickems: readonly PickemSummary[] }): ReactElement {
  if (pickems.length === 0) {
    return (
      <p className="notice">
        No pick&apos;em is open yet. One opens when the next season&apos;s players and groups are
        announced.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {pickems.map((p) => (
        <li key={p.season} className="flex flex-col gap-1 card p-4">
          <Link href={`/pickem/${p.season}`} className="text-heading">
            {p.title}
          </Link>
          <p className="text-caption text-ink-muted">{pickemStatusLine(p)}</p>
        </li>
      ))}
    </ul>
  );
}
