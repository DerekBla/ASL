import type { ReactElement } from "react";

import { chosen } from "@/lib/pickem/bracket";
import type { EntryScore, PickStatus } from "@/lib/pickem/scoring";
import type { PickemConfig, Selection } from "@/lib/pickem/types";

import { RaceBadge } from "@/components/RaceBadge";

type Props = {
  config: PickemConfig;
  selection: Selection;
  /** Marks each pick right or wrong. Left out when showing the real results. */
  score?: EntryScore;
  /** What an empty round says. */
  empty: string;
};

const MARK: Record<PickStatus, { symbol: string; label: string; style: string }> = {
  correct: { symbol: "✓", label: "right", style: "border-accent font-semibold" },
  wrong: { symbol: "✗", label: "wrong", style: "border-line text-ink-muted line-through" },
  pending: { symbol: "", label: "not decided yet", style: "border-line-strong" },
};

/** A bracket, round by round, read only. */
export function BracketView({ config, selection, score, empty }: Props): ReactElement {
  const race = new Map(config.entrants.map((e) => [e.player, e.race]));
  return (
    <div className="flex flex-col gap-3">
      {config.rounds.map((round, i) => {
        const picked = chosen(selection, round);
        const roundScore = score?.rounds[i];
        return (
          <section key={round.key} className="flex flex-col gap-2 card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h3>{round.label}</h3>
              {roundScore ? (
                <p className="text-caption text-ink-muted">
                  {roundScore.correct} of {round.advance} right ·{" "}
                  {roundScore.points === 1 ? "1 point" : `${roundScore.points} points`}
                </p>
              ) : null}
            </div>
            {picked.length === 0 ? (
              <p className="text-ink-muted">{empty}</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {picked.map((player) => {
                  const mark = score
                    ? MARK[score.statuses[round.key]?.[player] ?? "pending"]
                    : null;
                  return (
                    <li
                      key={player}
                      className={`inline-flex items-center gap-1.5 rounded border bg-card px-2 py-1 text-data ${mark?.style ?? "border-line-strong"}`}
                    >
                      <RaceBadge race={race.get(player) ?? null} />
                      <span>{player}</span>
                      {mark ? (
                        <>
                          {mark.symbol ? <span aria-hidden="true">{mark.symbol}</span> : null}
                          <span className="sr-only">{mark.label}</span>
                        </>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
