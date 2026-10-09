import Link from "next/link";
import type { ReactElement } from "react";

import { getElo, getManifest } from "@/lib/services/stats";
import { formatInteger, formatPercent, formatSeason } from "@/lib/utils/format";

import { EloTable } from "./EloTable";
import { EloTopChart } from "./EloTopChart";

type Props = {
  /** Rate qualifier games as well as the ASL's own. Each version has its own page. */
  withQualifiers: boolean;
};

/** Players drawn on the chart: the best current ratings. */
const TOP = 10;

const VIEWS = [
  { href: "/elo", label: "ASL games only", withQualifiers: false },
  { href: "/elo/with-qualifiers", label: "Including qualifiers", withQualifiers: true },
] as const;

/**
 * The ELO page: what the rating is, the switch between the two versions, the top players over
 * time and the full table. ELO is game based (Derek, 2026-10-09): see compute_game_elo in the
 * exporter.
 */
export function EloRatings({ withQualifiers }: Props): ReactElement {
  const { elo, seasons } = getManifest();
  const rows = getElo().map((row) => (withQualifiers ? { ...row, ...row.withQualifiers } : row));
  const top = [...rows]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, TOP)
    .map((row) => ({ rank: row.rank, player: row.player, history: row.history }));
  const firstQualifiers = elo.qualifierSeasons[0];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1>ELO ratings</h1>
        <p className="text-ink-muted">
          ELO from individual games. Every player starts at {formatInteger(elo.start)}. Each game
          moves the winner up and the loser down by the same amount, and by more when the result was
          an upset (K = {elo.k}). It counts all {formatInteger(elo.games)} games played in the ASL
          across {seasons.count} seasons.
        </p>
        <nav aria-label="Games counted" className="flex flex-wrap gap-1.5">
          {VIEWS.map((view) => {
            const on = view.withQualifiers === withQualifiers;
            return (
              <Link
                key={view.href}
                href={view.href}
                aria-current={on ? "page" : undefined}
                className={`rounded border px-2.5 py-1 text-data no-underline hover:no-underline ${on ? "border-accent bg-surface-muted font-semibold text-ink" : "border-line-strong bg-card hover:bg-surface-muted"}`}
              >
                {view.label}
              </Link>
            );
          })}
        </nav>
        <p className="text-caption text-ink-muted">
          In games where the two ratings differed, the higher rated player won{" "}
          {formatPercent(elo.favoriteGames > 0 ? elo.favoriteWins / elo.favoriteGames : null)} of
          the time. Each player&apos;s page shows what every series did to their rating. There is
          also a separate <Link href="/elo/matchups">ELO for each matchup</Link>.
        </p>
        {withQualifiers ? (
          <p className="text-caption text-ink-muted">
            This version also counts {formatInteger(elo.qualifierGames)} qualifier games
            {firstQualifiers === undefined
              ? ""
              : `, from ${formatSeason(firstQualifiers)} on (Liquipedia has no results for earlier qualifiers)`}
            . Qualifier opponents who never reached an ASL season move the ratings but are not
            listed. Ratings run higher here because the regulars beat many of them.
          </p>
        ) : null}
      </header>
      <EloTopChart players={top} lastSeason={seasons.count} start={elo.start} />
      <section aria-labelledby="all-ratings" className="flex flex-col gap-3">
        <h2 id="all-ratings">All ratings</h2>
        <EloTable withQualifiers={withQualifiers} />
      </section>
    </div>
  );
}
