import type { ReactElement } from "react";

import { chosen, groupsOf, hasRoom, poolFor } from "@/lib/pickem/bracket";
import type { PickemConfig, PickemEntrant, PickemRound, Selection } from "@/lib/pickem/types";

import { RaceBadge } from "@/components/RaceBadge";

type Props = {
  config: PickemConfig;
  selection: Selection;
  onToggle: (roundIdx: number, player: string) => void;
  disabled?: boolean;
};

/** "Pick 12 to advance, 2 from each group. 1 point each." */
export function roundHint(round: PickemRound, isLast: boolean): string {
  const points = `${round.points} ${round.points === 1 ? "point" : "points"}`;
  if (isLast) return `Pick the champion. ${points}.`;
  const groups = round.perGroup === null ? "" : `, ${round.perGroup} from each group`;
  return `Pick ${round.advance} to advance${groups}. ${points} each.`;
}

/**
 * Every round of a bracket as rows of toggle buttons. Used for a fan's picks and for the
 * admin's results; the parent owns the selection and applies togglePick.
 */
export function BracketPicker({ config, selection, onToggle, disabled }: Props): ReactElement {
  const entrant = new Map(config.entrants.map((e) => [e.player, e]));
  const lastIdx = config.rounds.length - 1;

  function toggle(roundIdx: number, e: PickemEntrant, picked: boolean): ReactElement {
    const round = config.rounds[roundIdx];
    const full = !picked && round?.advance !== 1 && !hasRoom(config, selection, roundIdx, e.player);
    return (
      <button
        key={e.player}
        type="button"
        aria-pressed={picked}
        disabled={disabled === true || full}
        onClick={() => onToggle(roundIdx, e.player)}
        className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-data transition disabled:cursor-not-allowed disabled:opacity-50 ${
          picked
            ? "border-accent bg-accent font-semibold text-on-accent"
            : "border-line-strong bg-card hover:bg-surface-muted"
        }`}
      >
        <RaceBadge race={e.race} />
        {e.player}
        {picked ? <span aria-hidden="true">✓</span> : null}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {config.rounds.map((round, i) => {
        const picked = new Set(chosen(selection, round));
        const pool = poolFor(config, selection, i)
          .map((p) => entrant.get(p))
          .filter((e): e is PickemEntrant => e !== undefined);
        const headingId = `round-${round.key}`;
        return (
          <section
            key={round.key}
            aria-labelledby={headingId}
            className="flex flex-col gap-2 card p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h3 id={headingId}>{round.label}</h3>
              <p className="text-caption text-ink-muted">
                {picked.size} of {round.advance} picked
              </p>
            </div>
            <p className="text-caption text-ink-muted">{roundHint(round, i === lastIdx)}</p>
            {round.perGroup !== null ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                {groupsOf(config).map((group) => (
                  <fieldset key={group} className="flex flex-col gap-1.5">
                    <legend className="text-caption font-semibold">Group {group}</legend>
                    {pool
                      .filter((e) => e.group === group)
                      .map((e) => toggle(i, e, picked.has(e.player)))}
                  </fieldset>
                ))}
              </div>
            ) : pool.length === 0 ? (
              <p className="text-ink-muted">Pick the round before this one first.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {pool.map((e) => toggle(i, e, picked.has(e.player)))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
