import type { ReactElement } from "react";

import type { Bracket, BracketMatch, BracketSide } from "@/lib/services/stats";

import { RaceBadge } from "@/components/RaceBadge";

import { PlayerLink } from "./PlayerLink";

type Props = {
  bracket: Bracket;
};

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
  return (
    <div className="bracket-match">
      <Side side={match.top} />
      <Side side={match.bottom} />
    </div>
  );
}

/**
 * The playoffs drawn as a bracket, earliest round on the left, like the one on Liquipedia. The
 * connector lines are in globals.css (.bracket). Wide brackets scroll sideways on a phone.
 */
export function PlayoffBracket({ bracket }: Props): ReactElement {
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
    </div>
  );
}
