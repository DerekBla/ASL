import type { ReactElement } from "react";

import type { GroupStage, Series, StageGroup } from "@/lib/services/stats";

import { RaceBadge } from "@/components/RaceBadge";

import { PlayerLink } from "./PlayerLink";

type Props = {
  stages: GroupStage[];
};

function MatchLine({ series, label }: { series: Series; label: string | null }): ReactElement {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-line px-3 py-1">
      {label ? <span className="w-28 text-caption text-ink-muted">{label}</span> : null}
      <RaceBadge race={series.winnerRace} />
      <span className="font-semibold">
        <PlayerLink name={series.winner} />
      </span>
      <span className="text-ink-muted">beat</span>
      <RaceBadge race={series.loserRace} />
      <PlayerLink name={series.loser} />
    </li>
  );
}

function Group({ group, stage }: { group: StageGroup; stage: string }): ReactElement {
  return (
    <div className="card overflow-hidden">
      <table aria-label={`${stage}, ${group.name}`} className="w-full border-collapse text-data">
        <caption className="bg-table-head px-3 py-1.5 text-left font-semibold">
          {group.name}
        </caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Player</th>
            <th scope="col">Record</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((row, i) => (
            <tr key={row.player} className="border-t border-line">
              <td
                className={`w-9 border-l-4 py-1 pl-2 text-ink-muted tabular-nums ${row.advanced ? "border-advance" : "border-transparent"}`}
              >
                {i + 1}.
              </td>
              <th scope="row" className="py-1 text-left font-normal">
                <span className="flex items-center gap-2">
                  <RaceBadge race={row.race} />
                  <PlayerLink name={row.player} />
                </span>
              </th>
              <td className="px-2 py-1 text-right tabular-nums">
                {row.wins}–{row.losses}
              </td>
              <td className="w-24 py-1 pr-3 text-right text-caption text-ink-muted">
                {row.advanced === null ? "" : row.advanced ? "Advanced" : "Out"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul aria-label={`${stage} ${group.name} matches`} className="text-data">
        {group.matches.map((m, i) => (
          <MatchLine key={i} series={m.series} label={m.label} />
        ))}
      </ul>
      {group.tiebreaker.length > 0 ? (
        <>
          <p className="border-t border-line bg-table-head px-3 py-1 text-caption font-semibold">
            Tiebreaker
          </p>
          <ul aria-label={`${stage} ${group.name} tiebreaker matches`} className="text-data">
            {group.tiebreaker.map((s, i) => (
              <MatchLine key={i} series={s} label={null} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/** Each group as a standings table with its matches underneath, one block per stage. */
export function GroupStages({ stages }: Props): ReactElement {
  return (
    <div className="flex flex-col gap-5">
      {stages.map((stage) => (
        <div key={stage.key} className="flex flex-col gap-3">
          <h3>{stage.label}</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {stage.groups.map((group) => (
              <Group key={group.name} group={group} stage={stage.label} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
