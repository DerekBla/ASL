import Link from "next/link";
import type { ReactElement } from "react";

import {
  getEloForPlayer,
  getManifest,
  getPlacementsForPlayer,
  getSeason,
  getSeriesForPlayer,
  getStatsForPlayer,
} from "@/lib/services/stats";
import type { Player } from "@/lib/services/stats";
import { RACES } from "@/lib/types/race";
import { formatElo, formatKrw, formatPercent, formatSeason } from "@/lib/utils/format";

import { DataTable } from "@/components/DataTable";
import type { DataTableColumn, DataTableRow } from "@/components/DataTable";
import { PlacementBadge } from "@/components/PlacementBadge";
import { RaceBadge } from "@/components/RaceBadge";

import { EloChart } from "./EloChart";
import { PlayerLink } from "./PlayerLink";

type Props = {
  player: Player;
};

const TIMELINE_COLUMNS: DataTableColumn[] = [
  { key: "season", header: "Season", firstSort: "desc" },
  { key: "placement", header: "Placement" },
  { key: "prize", header: "Prize", align: "right", firstSort: "desc" },
];

const OPPONENT_COLUMNS: DataTableColumn[] = [
  { key: "opponent", header: "Opponent" },
  { key: "race", header: "Race", align: "center" },
  { key: "record", header: "Series W–L", align: "right", sortable: false },
  { key: "played", header: "Played", align: "right", firstSort: "desc" },
  { key: "h2h", header: "", sortable: false },
];

export function PlayerProfile({ player }: Props): ReactElement {
  const stats = getStatsForPlayer(player.player);
  const elo = getEloForPlayer(player.player);
  const manifest = getManifest();
  const placements = getPlacementsForPlayer(player.player);
  const series = getSeriesForPlayer(player.player);

  const wins = series.filter((s) => s.winner === player.player).length;
  const losses = series.length - wins;
  const vsRace = RACES.map((race) => {
    const games = series.filter(
      (s) => (s.winner === player.player ? s.loserRace : s.winnerRace) === race,
    );
    const w = games.filter((s) => s.winner === player.player).length;
    return { race, wins: w, losses: games.length - w };
  });
  const opponents = new Map<string, { race: Player["race"]; wins: number; losses: number }>();
  for (const s of series) {
    const won = s.winner === player.player;
    const name = won ? s.loser : s.winner;
    const entry = opponents.get(name) ?? {
      race: won ? s.loserRace : s.winnerRace,
      wins: 0,
      losses: 0,
    };
    if (won) entry.wins += 1;
    else entry.losses += 1;
    opponents.set(name, entry);
  }

  const facts = [
    { label: "Seasons", value: String(stats?.seasons ?? 0) },
    { label: "Championships", value: String(stats?.championships ?? 0) },
    { label: "Finals", value: String(stats?.finals ?? 0) },
    { label: "Top 4", value: String(stats?.semifinalsOrBetter ?? 0) },
    { label: "Prize money", value: formatKrw(stats?.prizeKrw ?? null) },
    {
      label: "ELO (current / peak)",
      value: elo ? `${formatElo(elo.currentElo)} / ${formatElo(elo.peakElo)}` : "–",
    },
  ];

  const timeline: DataTableRow[] = placements.map((p) => ({
    id: String(p.season),
    cells: {
      season: (
        <Link href={`/seasons/${p.season}`}>
          {`${formatSeason(p.season)} · ${getSeason(p.season)?.name ?? ""}`}
        </Link>
      ),
      placement: <PlacementBadge placement={p.placement} />,
      prize: formatKrw(p.prizeKrw),
    },
    sort: { season: p.season, placement: p.placement.best, prize: p.prizeKrw },
  }));

  const opponentRows: DataTableRow[] = [...opponents].map(([name, o]) => ({
    id: name,
    cells: {
      opponent: <PlayerLink name={name} />,
      race: <RaceBadge race={o.race} />,
      record: `${o.wins}–${o.losses}`,
      played: o.wins + o.losses,
      h2h: (
        <Link
          href={`/head-to-head?a=${encodeURIComponent(player.player)}&b=${encodeURIComponent(name)}`}
        >
          Head to head
        </Link>
      ),
    },
    sort: { opponent: name, race: o.race, played: o.wins + o.losses },
  }));

  return (
    <div className="flex flex-col gap-8">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label} className="stat">
            <dt className="text-caption text-ink-muted">{f.label}</dt>
            <dd className="text-heading tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>
      {elo ? (
        <p className="-mt-5 text-caption text-ink-muted">
          ELO rank {elo.rank}, peak in {formatSeason(elo.peakSeason)}. This ELO comes from season
          placements: it rates where a player finished each season, not individual games.
        </p>
      ) : null}

      {elo ? (
        <section aria-label="ELO history" className="card p-5">
          <EloChart
            player={player.player}
            history={elo.history}
            lastSeason={manifest.seasons.count}
            start={manifest.elo.start}
          />
        </section>
      ) : null}

      <section aria-labelledby="timeline-heading" className="flex flex-col gap-3">
        <h2 id="timeline-heading">Season by season</h2>
        <DataTable
          caption={`${placements.length} seasons entered`}
          columns={TIMELINE_COLUMNS}
          rows={timeline}
          initialSort={{ key: "season", dir: "desc" }}
        />
      </section>

      <section aria-labelledby="record-heading" className="flex flex-col gap-3">
        <h2 id="record-heading">Series record</h2>
        <p>
          <strong className="tabular-nums">
            {wins}–{losses}
          </strong>{" "}
          in group and playoff series ({formatPercent(series.length ? wins / series.length : null)}
          ).
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Series record by opponent race">
          {vsRace.map((v) => {
            const played = v.wins + v.losses;
            return (
              <li key={v.race} className="flex items-center gap-2">
                <span>vs</span>
                <RaceBadge race={v.race} display="name" />
                <span className="tabular-nums">
                  {v.wins}–{v.losses}
                </span>
                <span className="text-ink-muted tabular-nums">
                  {played > 0 ? formatPercent(v.wins / played) : "no series"}
                </span>
              </li>
            );
          })}
        </ul>
        {opponentRows.length > 0 ? (
          <DataTable
            caption="Every opponent faced in a series"
            columns={OPPONENT_COLUMNS}
            rows={opponentRows}
            initialSort={{ key: "played", dir: "desc" }}
          />
        ) : null}
      </section>
    </div>
  );
}
