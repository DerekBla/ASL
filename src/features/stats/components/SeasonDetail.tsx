import type { ReactElement } from "react";

import { getPlacementsForSeason, getSeriesForSeason } from "@/lib/services/stats";
import type { Season, Series } from "@/lib/services/stats";
import { formatDateRange, formatInteger, formatKrw, formatScore } from "@/lib/utils/format";

import { DataTable } from "@/components/DataTable";
import type { DataTableColumn, DataTableRow } from "@/components/DataTable";
import { PlacementBadge } from "@/components/PlacementBadge";
import { RaceBadge } from "@/components/RaceBadge";

import { PlayerLink } from "./PlayerLink";

type Props = {
  season: Season;
};

const PLACEMENT_COLUMNS: DataTableColumn[] = [
  { key: "placement", header: "Placement" },
  { key: "player", header: "Player" },
  { key: "race", header: "Race", align: "center" },
  { key: "prize", header: "Prize", align: "right", firstSort: "desc" },
];

const ROUND_ORDER = ["final", "third_place", "semifinal", "quarterfinal"];
const ROUND_LABEL: Record<string, string> = {
  final: "Final",
  third_place: "Third-place match",
  semifinal: "Semifinal",
  quarterfinal: "Quarterfinal",
};

function SeriesLine({ s }: { s: Series }): ReactElement {
  return (
    <li className="flex flex-wrap items-center gap-2">
      <RaceBadge race={s.winnerRace} />
      <PlayerLink name={s.winner} />
      <span className="text-ink-muted">beat</span>
      <RaceBadge race={s.loserRace} />
      <PlayerLink name={s.loser} />
      {s.score ? <span className="tabular-nums">{formatScore(s.score)}</span> : null}
    </li>
  );
}

export function SeasonDetail({ season }: Props): ReactElement {
  const placements = getPlacementsForSeason(season.season);
  const series = getSeriesForSeason(season.season);
  const playoffs = series
    .filter((s) => s.stage === "playoffs")
    .sort((a, b) => ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round));
  const groups = new Map<string, Series[]>();
  for (const s of series.filter((x) => x.stage !== "playoffs")) {
    const key = `${s.stage === "ro24" ? "Round of 24" : "Round of 16"} · ${s.round}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

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
          <div key={f.label} className="rounded-lg border border-line bg-surface-muted p-3">
            <dt className="text-caption text-ink-muted">{f.label}</dt>
            <dd className="text-heading tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="playoffs-heading" className="flex flex-col gap-3">
        <h2 id="playoffs-heading">Playoffs</h2>
        {ROUND_ORDER.map((round) => {
          const matches = playoffs.filter((s) => s.round === round);
          if (matches.length === 0) return null;
          return (
            <div key={round} className="flex flex-col gap-1">
              <h3>{ROUND_LABEL[round]}</h3>
              <ul className="flex flex-col gap-1">
                {matches.map((s) => (
                  <SeriesLine key={`${s.winner}-${s.loser}`} s={s} />
                ))}
              </ul>
            </div>
          );
        })}
        {season.thirdPlaceMatch ? null : (
          <p className="text-caption text-ink-muted">
            No third-place match this season, so both semifinal losers share 3rd.
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[...groups].map(([name, matches]) => (
            <div key={name} className="rounded-lg border border-line p-3">
              <h3 className="mb-2">{name}</h3>
              <ul className="flex flex-col gap-1 text-data">
                {matches.map((s, i) => (
                  <SeriesLine key={i} s={s} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <p className="text-caption text-ink-muted">
        Source: <a href={season.source.url}>{season.source.title}</a> on Liquipedia (revision{" "}
        {season.source.revid}).
      </p>
    </div>
  );
}
