import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

import { seriesWinProbability } from "@/lib/market/priors";
import {
  buildBracket,
  getBestOf,
  getSeasonInProgress,
  getSeriesForSeason,
  getWinChance,
} from "@/lib/services/stats";
import type { Season } from "@/lib/services/stats";
import { formatDateRange, formatProbability } from "@/lib/utils/format";

import { PlayerLink } from "./PlayerLink";
import { PlayoffBracket } from "./PlayoffBracket";

type Props = {
  /** Open markets on this season, supplied by the page when markets are switched on. */
  markets?: ReactNode;
};

const ROUND_NAME: Record<Season["upcoming"][number]["round"], string> = {
  quarterfinal: "Quarterfinal",
  semifinal: "Semifinal",
  final: "Final",
};

function Next({ series }: { series: Season["upcoming"][number] }): ReactElement | null {
  const [a, b] = series.players;
  if (!a || !b) return null;
  const game = getWinChance(a.player, b.player)?.game;
  const bestOf = getBestOf(series.round) ?? 1;
  const chanceA = game === undefined ? undefined : seriesWinProbability(game, bestOf);
  const favorite = chanceA === undefined || chanceA >= 0.5 ? a : b;
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <strong>{ROUND_NAME[series.round]}:</strong>
      <span>
        <PlayerLink name={a.player} /> against <PlayerLink name={b.player} />
      </span>
      {chanceA === undefined ? null : (
        <span className="text-ink-muted">
          ELO gives {favorite.player} {formatProbability(favorite === a ? chanceA : 1 - chanceA)}
          {bestOf > 1 ? ` in a best of ${bestOf}` : ""}.
        </span>
      )}
      <Link
        href={`/head-to-head?a=${encodeURIComponent(a.player)}&b=${encodeURIComponent(b.player)}`}
      >
        Head to head
      </Link>
    </li>
  );
}

/**
 * The home page panel for a season that is being played: what is still to come, the bracket
 * as it stands, and any open markets. Renders nothing between seasons.
 */
export function LiveSeason({ markets }: Props): ReactElement | null {
  const season = getSeasonInProgress();
  if (!season) return null;
  const bracket = buildBracket(getSeriesForSeason(season.season), season.upcoming);
  return (
    <section aria-labelledby="live-heading" className="card flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 id="live-heading">On now: {season.name}</h2>
        <p className="text-ink-muted">
          {formatDateRange(season.start, season.end)}.{" "}
          <Link href={`/seasons/${season.season}`}>Groups, placements and VODs</Link>
        </p>
      </div>
      {season.upcoming.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h3>Still to play</h3>
          <ul className="flex flex-col gap-1">
            {season.upcoming.map((u) => (
              <Next key={u.players.map((p) => p.player).join("-")} series={u} />
            ))}
          </ul>
        </div>
      ) : null}
      {bracket.rounds.length > 0 ? (
        <PlayoffBracket bracket={bracket} />
      ) : (
        <p className="text-ink-muted">The group stages are being played.</p>
      )}
      {markets}
    </section>
  );
}
