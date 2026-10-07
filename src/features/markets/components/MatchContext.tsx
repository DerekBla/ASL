import Link from "next/link";
import type { ReactElement } from "react";

import { findPlayer, getEloForPlayer, getHeadToHead, playerSlug } from "@/lib/services/stats";
import { formatElo } from "@/lib/utils/format";

import { RaceBadge } from "@/components/RaceBadge";

/** ASL history for a player-vs-player market, from the stats data. */
export function MatchContext({ players }: { players: readonly string[] }): ReactElement | null {
  const known = players.map((p) => findPlayer(p)).filter((p) => p !== undefined);
  if (known.length === 0) return null;
  const [a, b] = known;
  const h2h = a && b ? getHeadToHead(a.player, b.player) : undefined;

  return (
    <section
      aria-labelledby="context-heading"
      className="flex flex-col gap-3 rounded-lg border border-line p-4"
    >
      <h2 id="context-heading">ASL history</h2>
      <ul className="flex flex-col gap-1">
        {known.map((p) => {
          const elo = getEloForPlayer(p.player);
          return (
            <li key={p.player} className="flex flex-wrap items-center gap-2">
              <RaceBadge race={p.race} />
              <Link href={`/players/${playerSlug(p.player)}`}>{p.player}</Link>
              {elo ? (
                <span className="text-ink-muted">
                  ELO {formatElo(elo.currentElo)} (rank {elo.rank}), {elo.championships}{" "}
                  {elo.championships === 1 ? "title" : "titles"}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {h2h && a && b ? (
        <p>
          Head-to-head in ASL series: {a.player} {h2h.winsA}–{h2h.winsB} {b.player}.{" "}
          <Link
            href={`/head-to-head?a=${encodeURIComponent(a.player)}&b=${encodeURIComponent(b.player)}`}
          >
            Every meeting
          </Link>
        </p>
      ) : null}
    </section>
  );
}
