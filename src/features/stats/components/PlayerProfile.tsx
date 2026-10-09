import Link from "next/link";
import type { ReactElement } from "react";

import {
  getEloForPlayer,
  getManifest,
  getMapsForPlayer,
  getPlacementsForPlayer,
  getSeason,
  getSeriesForPlayer,
  getStatsForPlayer,
  mapSlug,
  MIN_MATCHUP_GAMES,
} from "@/lib/services/stats";
import type { Player } from "@/lib/services/stats";
import { RACE_NAMES, RACES } from "@/lib/types/race";
import {
  formatElo,
  formatEloChange,
  formatKrw,
  formatPercent,
  formatSeason,
} from "@/lib/utils/format";

import { DataTable } from "@/components/DataTable";
import type { DataTableColumn, DataTableRow } from "@/components/DataTable";
import { PlacementBadge } from "@/components/PlacementBadge";
import { RaceBadge } from "@/components/RaceBadge";

import { EloChart } from "./EloChart";
import { PlayerLink } from "./PlayerLink";
import { gamesFor, roundLabel } from "./series-text";

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

const LOG_COLUMNS: DataTableColumn[] = [
  { key: "season", header: "Season", firstSort: "desc" },
  { key: "round", header: "Round", sortable: false },
  { key: "opponent", header: "Opponent" },
  { key: "opponentElo", header: "Opponent ELO", align: "right", firstSort: "desc" },
  { key: "result", header: "Result", sortable: false },
  { key: "before", header: "ELO before", align: "right", firstSort: "desc" },
  { key: "change", header: "Change", align: "right", firstSort: "desc" },
  { key: "after", header: "ELO after", align: "right", firstSort: "desc" },
];

const MAP_COLUMNS: DataTableColumn[] = [
  { key: "map", header: "Map" },
  { key: "played", header: "Games", align: "right", firstSort: "desc" },
  { key: "record", header: "W–L", align: "right", sortable: false },
  { key: "rate", header: "Win rate", align: "right", firstSort: "desc" },
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
    const against = series.filter(
      (s) => (s.winner === player.player ? s.loserRace : s.winnerRace) === race,
    );
    const w = against.filter((s) => s.winner === player.player).length;
    return { race, wins: w, losses: against.length - w, rating: elo?.vsRace[race] };
  });

  // Oldest first, so a row's place in the list is the order the series were played in.
  const log: DataTableRow[] = series.map((s, i) => {
    const won = s.winner === player.player;
    const opponent = won ? s.loser : s.winner;
    const before = won ? s.elo.winnerBefore : s.elo.loserBefore;
    const after = won ? s.elo.winnerAfter : s.elo.loserAfter;
    const games = gamesFor(s, player.player);
    return {
      id: String(i).padStart(4, "0"),
      cells: {
        season: <Link href={`/seasons/${s.season}`}>{formatSeason(s.season)}</Link>,
        round: roundLabel(s),
        opponent: (
          <span className="inline-flex items-center gap-2">
            <RaceBadge race={won ? s.loserRace : s.winnerRace} />
            <PlayerLink name={opponent} />
          </span>
        ),
        opponentElo: formatElo(won ? s.elo.loserBefore : s.elo.winnerBefore),
        result: `${won ? "Won" : "Lost"}${games ? ` ${games.won}–${games.lost}` : ""}`,
        before: formatElo(before),
        change: <strong>{formatEloChange(after - before)}</strong>,
        after: formatElo(after),
      },
      sort: {
        season: i,
        opponent,
        opponentElo: won ? s.elo.loserBefore : s.elo.winnerBefore,
        before,
        change: after - before,
        after,
      },
    };
  });

  const mapRows: DataTableRow[] = getMapsForPlayer(player.player).map((m) => ({
    id: m.map,
    cells: {
      map: <Link href={`/maps/${mapSlug(m.map)}`}>{m.map}</Link>,
      played: m.wins + m.losses,
      record: `${m.wins}–${m.losses}`,
      rate: formatPercent(m.wins / (m.wins + m.losses)),
    },
    sort: { map: m.map, played: m.wins + m.losses, rate: m.wins / (m.wins + m.losses) },
  }));
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
          ELO rank {elo.rank}, peak in {formatSeason(elo.peakSeason)}. This ELO comes from the{" "}
          {elo.games} games this player has played in the ASL, not from qualifiers.
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
        <div className="card overflow-x-auto">
          <table
            aria-label="Record by opponent race"
            className="w-full border-collapse text-data tabular-nums"
          >
            <thead className="bg-table-head">
              <tr>
                <th scope="col" className="px-2 py-1 text-left">
                  Against
                </th>
                <th scope="col" className="px-2 py-1 text-right">
                  Series W–L
                </th>
                <th scope="col" className="px-2 py-1 text-right">
                  Series won
                </th>
                <th scope="col" className="px-2 py-1 text-right">
                  Games W–L
                </th>
                <th scope="col" className="px-2 py-1 text-right">
                  Matchup ELO
                </th>
              </tr>
            </thead>
            <tbody>
              {vsRace.map((v) => {
                const played = v.wins + v.losses;
                const games = v.rating?.games ?? 0;
                return (
                  <tr key={v.race} className="border-t border-line">
                    <th scope="row" className="px-2 py-1 text-left font-normal">
                      <RaceBadge race={v.race} display="name" />
                    </th>
                    <td className="px-2 py-1 text-right">
                      {played > 0 ? `${v.wins}–${v.losses}` : "–"}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {played > 0 ? formatPercent(v.wins / played) : "–"}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {v.rating && games > 0 ? `${v.rating.wins}–${games - v.rating.wins}` : "–"}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {v.rating?.elo === null || v.rating?.elo === undefined
                        ? "–"
                        : formatElo(v.rating.elo)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-caption text-ink-muted">
          Matchup ELO is the same rating counting only the games against that race, so it starts
          from {manifest.elo.start} in each matchup. With fewer than {MIN_MATCHUP_GAMES} games it
          says little.{" "}
          {player.race ? (
            <Link href="/elo/matchups">
              See how it compares with other {RACE_NAMES[player.race]} players
            </Link>
          ) : null}
        </p>
        {opponentRows.length > 0 ? (
          <DataTable
            caption="Every opponent faced in a series"
            columns={OPPONENT_COLUMNS}
            rows={opponentRows}
            initialSort={{ key: "played", dir: "desc" }}
          />
        ) : null}
      </section>

      {log.length > 0 ? (
        <section aria-labelledby="log-heading" className="flex flex-col gap-3">
          <h2 id="log-heading">Every series and what it did to the ELO</h2>
          <p className="text-caption text-ink-muted">
            A win over a higher rated opponent is worth more than one over a lower rated opponent,
            and a loss to a lower rated opponent costs more. A series moves the rating once per
            game, so a narrow win over a much lower rated player can still cost points.
          </p>
          <DataTable
            caption={`${log.length} series, newest first. Select a column to sort.`}
            columns={LOG_COLUMNS}
            rows={log}
            initialSort={{ key: "season", dir: "desc" }}
          />
        </section>
      ) : null}

      {mapRows.length > 0 ? (
        <section aria-labelledby="maps-heading" className="flex flex-col gap-3">
          <h2 id="maps-heading">Maps</h2>
          <DataTable
            caption={`Games on ${mapRows.length} maps, most played first. Sort by win rate for the best and worst.`}
            columns={MAP_COLUMNS}
            rows={mapRows}
            initialSort={{ key: "played", dir: "desc" }}
          />
        </section>
      ) : null}
    </div>
  );
}
