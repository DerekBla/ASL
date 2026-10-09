import type { ReactElement } from "react";

import type { Bracket, BracketMatch, BracketSide, Season } from "@/lib/services/stats";

import { RaceBadge } from "@/components/RaceBadge";

import { PlayerLink } from "./PlayerLink";
import { VodLink } from "./VodLink";

type Props = {
  bracket: Bracket;
  /** Casts titled by broadcast day, shown under the bracket for the rounds they cover. */
  roundVods?: Season["roundVods"];
};

const ROUND_VOD_LABEL = { quarterfinal: "Quarterfinal casts", semifinal: "Semifinal casts" };

function Side({ side }: { side: BracketSide }): ReactElement {
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1 ${side.won ? "bg-surface-muted font-semibold" : ""}`}
    >
      <RaceBadge race={side.race} />
      <span className="min-w-0 flex-1 truncate">
        <PlayerLink name={side.player} />
      </span>
      {side.won ? <span className="sr-only">won</span> : null}
      <span className={`tabular-nums ${side.won ? "" : "text-ink-muted"}`}>
        {side.score ?? "–"}
      </span>
    </div>
  );
}

function Match({ match }: { match: BracketMatch }): ReactElement {
  const maps = match.games.filter((g) => g.map !== null);
  return (
    <div className="bracket-match">
      <Side side={match.top} />
      <Side side={match.bottom} />
      {maps.length > 0 || match.vod ? (
        <div className="flex items-start gap-2 px-2 py-1 text-caption">
          {maps.length > 0 ? (
            <details className="group min-w-0 flex-1">
              <summary className="cursor-pointer font-semibold text-link select-none">
                <span className="group-open:hidden">Show maps</span>
                <span className="hidden group-open:inline">Hide maps</span>
              </summary>
              <ol className="mt-1 flex flex-col gap-0.5">
                {maps.map((g, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">{g.map}</span>
                    <span className="shrink-0 text-ink-muted">{g.winner}</span>
                  </li>
                ))}
              </ol>
            </details>
          ) : (
            <span className="flex-1" />
          )}
          {match.vod ? (
            <VodLink url={match.vod} of={`${match.top.player} against ${match.bottom.player}`} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The playoffs drawn as a bracket, earliest round on the left, like the one on Liquipedia. The
 * connector lines are in globals.css (.bracket). Wide brackets scroll sideways on a phone.
 * Each series can open its list of maps and link the English cast.
 */
export function PlayoffBracket({ bracket, roundVods = [] }: Props): ReactElement {
  const rounds = (["quarterfinal", "semifinal"] as const)
    .map((round) => ({ round, vods: roundVods.filter((v) => v.round === round) }))
    .filter((r) => r.vods.length > 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto pb-1">
        <div className="bracket">
          {bracket.rounds.map((round) => (
            <section key={round.key} aria-label={round.label} className="bracket-round">
              <h3 className="bracket-heading">{round.label}</h3>
              <ol className="bracket-slots">
                {round.matches.map((match) => (
                  <li key={`${match.top.player}-${match.bottom.player}`} className="bracket-slot">
                    <Match match={match} />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
      {bracket.thirdPlace ? (
        <section aria-label="Third place match" className="flex flex-col gap-1">
          <h3 className="bracket-heading w-48">Third place match</h3>
          <Match match={bracket.thirdPlace} />
        </section>
      ) : null}
      {rounds.length > 0 ? (
        <dl className="flex flex-col gap-1.5 text-data">
          {rounds.map(({ round, vods }) => (
            <div key={round} className="flex flex-wrap items-center gap-2">
              <dt className="text-ink-muted">{ROUND_VOD_LABEL[round]}</dt>
              {vods.map((v) => (
                <dd key={v.url}>
                  <VodLink
                    url={v.url}
                    of={`${ROUND_VOD_LABEL[round]}, ${v.label}`}
                    label={v.label}
                  />
                </dd>
              ))}
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
