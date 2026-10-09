import type { ReactElement } from "react";

import {
  buildBracket,
  buildGroupStages,
  getPlacementsForSeason,
  getSeriesForSeason,
} from "@/lib/services/stats";
import type { Season } from "@/lib/services/stats";
import { formatDateRange, formatInteger, formatKrw } from "@/lib/utils/format";

import { DataTable } from "@/components/DataTable";
import type { DataTableColumn, DataTableRow } from "@/components/DataTable";
import { PlacementBadge } from "@/components/PlacementBadge";
import { RaceBadge } from "@/components/RaceBadge";

import { GroupStages } from "./GroupStages";
import { PlayerLink } from "./PlayerLink";
import { PlayoffBracket } from "./PlayoffBracket";

type Props = {
  season: Season;
};

const PLACEMENT_COLUMNS: DataTableColumn[] = [
  { key: "placement", header: "Placement" },
  { key: "player", header: "Player" },
  { key: "race", header: "Race", align: "center" },
  { key: "prize", header: "Prize", align: "right", firstSort: "desc" },
];

export function SeasonDetail({ season }: Props): ReactElement {
  const placements = getPlacementsForSeason(season.season);
  const series = getSeriesForSeason(season.season);
  const bracket = buildBracket(series);
  const stages = buildGroupStages(series);

  const rows: DataTableRow[] = placements.map((p) => ({
    id: p.player,
    cells: {
      placement: <PlacementBadge placement={p.placement} />,
      player: <PlayerLink name={p.player} />,
      race: <RaceBadge race={p.race} />,
      prize: formatKrw(p.prizeKrw),
    },
    sort: {
      placement: p.placement.best * 100 + p.placement.worst,
      player: p.player,
      race: p.race,
      prize: p.prizeKrw,
    },
  }));

  const facts = [
    { label: "Dates", value: formatDateRange(season.start, season.end) },
    { label: "Prize pool", value: formatKrw(season.prizePoolKrw) },
    { label: "Players", value: formatInteger(season.players) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label} className="stat">
            <dt className="text-caption text-ink-muted">{f.label}</dt>
            <dd className="text-heading tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="playoffs-heading" className="flex flex-col gap-3">
        <h2 id="playoffs-heading">Playoffs</h2>
        {bracket.rounds.length > 0 ? (
          <PlayoffBracket bracket={bracket} />
        ) : (
          <p className="text-ink-muted">The playoffs have not started.</p>
        )}
        {season.thirdPlaceMatch ? null : (
          <p className="text-caption text-ink-muted">
            No third place match this season, so both semifinal losers share 3rd.
          </p>
        )}
      </section>

      <section aria-labelledby="placements-heading" className="flex flex-col gap-3">
        <h2 id="placements-heading">Final placements</h2>
        <DataTable
          caption={`All ${placements.length} players, best finish first`}
          columns={PLACEMENT_COLUMNS}
          rows={rows}
        />
      </section>

      <section aria-labelledby="groups-heading" className="flex flex-col gap-3">
        <h2 id="groups-heading">Group stages</h2>
        <p className="text-caption text-ink-muted">
          Players are listed by their record in the group. A green bar marks the players who
          advanced.
        </p>
        <GroupStages stages={stages} />
      </section>

      <p className="text-caption text-ink-muted">
        Source: <a href={season.source.url}>{season.source.title}</a> on Liquipedia (revision{" "}
        {season.source.revid}).
      </p>
    </div>
  );
}
