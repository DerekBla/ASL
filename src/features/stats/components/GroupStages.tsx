import type { ReactElement } from "react";

import type { GroupStage, Series, StageGroup } from "@/lib/services/stats";

import { RaceBadge } from "@/components/RaceBadge";

import { PlayerLink } from "./PlayerLink";
import { VodLink } from "./VodLink";

type Props = {
  stages: GroupStage[];
};

/** "Fighting Spirit" for one game; "2–1 on Eclipse, Polypoid, Radeon" for a longer series. */
function mapsLine(series: Series): string | null {
  const maps = series.games.flatMap((g) => (g.map ? [g.map] : []));
  if (maps.length === 0) return null;
  if (series.games.length === 1) return maps[0] ?? null;
  const won = series.games.filter((g) => g.winner === series.winner).length;
  return `${won}–${series.games.length - won} on ${maps.join(", ")}`;
}

type MatchLineProps = {
  series: Series;
  label: string | null;
  /** The cast already linked from the group's heading; a match links its own only when it differs. */
  groupVod: string | null;
};

function MatchLine({ series, label, groupVod }: MatchLineProps): ReactElement {
  const maps = mapsLine(series);
  return (
    <li className="flex flex-col gap-0.5 border-t border-line px-3 py-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {label ? <span className="w-28 text-caption text-ink-muted">{label}</span> : null}
        <RaceBadge race={series.winnerRace} />
        <span className="font-semibold">
          <PlayerLink name={series.winner} />
        </span>
        <span className="text-ink-muted">beat</span>
        <RaceBadge race={series.loserRace} />
        <PlayerLink name={series.loser} />
        {series.vod !== null && series.vod !== groupVod ? (
          <span className="ml-auto">
            <VodLink url={series.vod} of={`${series.winner} against ${series.loser}`} />
          </span>
        ) : null}
      </div>
      {maps ? (
        <div className={`text-caption text-ink-muted ${label ? "sm:pl-30" : ""}`}>
          <span className="sr-only">Played on </span>
          {maps}
        </div>
      ) : null}
    </li>
  );
}

function Group({ group, stage }: { group: StageGroup; stage: string }): ReactElement {
  const count = group.matches.length + group.tiebreaker.length;
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-2 bg-table-head px-3 py-1.5">
        <h4 className="text-data font-semibold">{group.name}</h4>
        {group.vod ? <VodLink url={group.vod} of={`${stage} ${group.name}`} /> : null}
      </div>
      <table aria-label={`${stage}, ${group.name}`} className="w-full border-collapse text-data">
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
      <details className="group border-t border-line text-data">
        <summary className="cursor-pointer px-3 py-1.5 text-caption font-semibold text-link select-none hover:bg-surface-muted">
          <span className="group-open:hidden">Show the {count} matches and maps</span>
          <span className="hidden group-open:inline">Hide the matches</span>
        </summary>
        <ul aria-label={`${stage} ${group.name} matches`}>
          {group.matches.map((m, i) => (
            <MatchLine key={i} series={m.series} label={m.label} groupVod={group.vod} />
          ))}
        </ul>
        {group.tiebreaker.length > 0 ? (
          <>
            <p className="border-t border-line bg-table-head px-3 py-1 text-caption font-semibold">
              Tiebreaker
            </p>
            <ul aria-label={`${stage} ${group.name} tiebreaker matches`}>
              {group.tiebreaker.map((s, i) => (
                <MatchLine key={i} series={s} label={null} groupVod={group.vod} />
              ))}
            </ul>
          </>
        ) : null}
      </details>
    </div>
  );
}

/**
 * Each group as a standings table, one block per stage. The matches, with the map each was
 * played on, open on a click. The VOD button opens the English cast of the group.
 */
export function GroupStages({ stages }: Props): ReactElement {
  return (
    <div className="flex flex-col gap-5">
      {stages.map((stage) => (
        <div key={stage.key} className="flex flex-col gap-3">
          <h3>{stage.label}</h3>
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
            {stage.groups.map((group) => (
              <Group key={group.name} group={group} stage={stage.label} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
