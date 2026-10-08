import Link from "next/link";
import type { ReactElement } from "react";

import { formatKoreaTime, formatMinerals, formatProbability } from "@/lib/utils/format";

import type { MarketSummary } from "../types";

const BADGE: Record<string, string> = {
  open: "Open",
  closed: "Closed",
  resolved: "Resolved",
  voided: "Voided",
};

export function MarketsList({ markets }: { markets: readonly MarketSummary[] }): ReactElement {
  if (markets.length === 0) {
    return <p className="text-ink-muted">No markets yet. The first one opens soon.</p>;
  }
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {markets.map((m) => {
        const winner = m.resolvedOutcome === null ? undefined : m.outcomes[m.resolvedOutcome];
        return (
          <li key={m.slug}>
            <Link
              href={`/markets/${m.slug}`}
              className="flex h-full flex-col gap-3 card p-5 text-ink no-underline transition-shadow hover:no-underline hover:shadow-md"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="text-heading">{m.question}</span>
                <span className="shrink-0 rounded bg-surface-muted px-2 text-caption">
                  {BADGE[m.status]}
                </span>
              </span>
              <span className="flex flex-wrap gap-x-4 gap-y-1">
                {m.outcomes.map((o) => (
                  <span key={o.idx} className="tabular-nums">
                    {o.label} <strong>{formatProbability(o.price)}</strong>
                  </span>
                ))}
              </span>
              <span className="text-caption text-ink-muted">
                {winner ? `${winner.label} won · ` : ""}
                {m.status === "open" ? "Closes" : "Closed"} {formatKoreaTime(m.closesAt)} ·{" "}
                {formatMinerals(m.volume)} traded
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
