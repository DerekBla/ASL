"use client";

import Link from "next/link";
import type { ReactElement } from "react";

import { formatKoreaTime, formatProbability } from "@/lib/utils/format";

import { useMarkets } from "../hooks/use-market";

/**
 * The open markets on one season, for the home page's panel. Loaded in the browser so the
 * home page can stay static. Shows nothing while loading, on an error, or with none open.
 */
export function SeasonMarkets({ season }: { season: number }): ReactElement | null {
  const { data } = useMarkets();
  const open = (data ?? []).filter((m) => m.status === "open" && m.season === season);
  if (open.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <h3>Open markets</h3>
      <ul className="flex flex-col gap-1">
        {open.map((m) => (
          <li key={m.slug} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Link href={`/markets/${m.slug}`}>{m.question}</Link>
            <span className="tabular-nums">
              {m.outcomes.map((o) => `${o.label} ${formatProbability(o.price)}`).join(" · ")}
            </span>
            <span className="text-caption text-ink-muted">
              Closes {formatKoreaTime(m.closesAt)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-caption text-ink-muted">
        Prices are the crowd&apos;s odds. Markets use minerals, which are play money.
      </p>
    </div>
  );
}
