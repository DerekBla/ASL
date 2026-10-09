import Link from "next/link";
import type { ReactElement } from "react";

import { getMaps, mapSlug } from "@/lib/services/stats";
import type { MapStats } from "@/lib/services/stats";
import { RACE_NAMES } from "@/lib/types/race";
import { formatPercent, formatSeason } from "@/lib/utils/format";

import { DataTable } from "@/components/DataTable";
import type { DataTableColumn, DataTableRow } from "@/components/DataTable";
import { RaceBadge } from "@/components/RaceBadge";

import { PlayerLink } from "./PlayerLink";

/** "S3", or "S10 to S19" for a map used in more than one season. */
export function seasonSpan(seasons: readonly number[]): string {
  const first = seasons[0];
  const last = seasons.at(-1);
  if (first === undefined || last === undefined) return "–";
  return first === last ? formatSeason(first) : `${formatSeason(first)} to ${formatSeason(last)}`;
}

const matchupKey = (m: MapStats["matchups"][number]): string => `${m.race}v${m.vs}`;
const matchupName = (m: MapStats["matchups"][number]): string =>
  `${RACE_NAMES[m.race]} vs ${RACE_NAMES[m.vs]}`;

/** The first race's record, with its win rate: "12–9 (57.1%)". */
function matchupCell(m: MapStats["matchups"][number]): string {
  return m.wins + m.losses === 0 ? "–" : `${m.wins}–${m.losses} (${formatPercent(m.winRate)})`;
}

/** Every map, most played first, with how the races have done against each other on it. */
export function MapsTable(): ReactElement {
  const maps = getMaps();
  const sample = maps[0];
  const columns: DataTableColumn[] = [
    { key: "map", header: "Map" },
    { key: "games", header: "Games", align: "right", firstSort: "desc" },
    { key: "seasons", header: "Seasons" },
    ...(sample?.matchups ?? []).map((m) => ({
      key: matchupKey(m),
      header: matchupName(m),
      align: "right" as const,
      firstSort: "desc" as const,
    })),
    { key: "mirrors", header: "Mirrors", align: "right", firstSort: "desc" },
  ];
  const rows: DataTableRow[] = maps.map((m) => {
    const mirrors = m.mirrors.TvT + m.mirrors.ZvZ + m.mirrors.PvP;
    return {
      id: m.map,
      cells: {
        map: (
          <Link href={`/maps/${mapSlug(m.map)}`} className="font-medium">
            {m.map}
          </Link>
        ),
        games: m.games,
        seasons: seasonSpan(m.seasons),
        ...Object.fromEntries(m.matchups.map((x) => [matchupKey(x), matchupCell(x)])),
        mirrors,
      },
      sort: {
        map: m.map,
        games: m.games,
        seasons: m.seasons[0] ?? null,
        ...Object.fromEntries(m.matchups.map((x) => [matchupKey(x), x.winRate])),
        mirrors,
      },
    };
  });
  return (
    <DataTable
      caption={`${maps.length} maps. Each matchup column is the first race's games won and lost, with its win rate. Select a column to sort.`}
      columns={columns}
      rows={rows}
      initialSort={{ key: "games", dir: "desc" }}
    />
  );
}

const PLAYER_COLUMNS: DataTableColumn[] = [
  { key: "player", header: "Player" },
  { key: "race", header: "Race", align: "center" },
  { key: "played", header: "Games", align: "right", firstSort: "desc" },
  { key: "record", header: "W–L", align: "right", sortable: false },
  { key: "rate", header: "Win rate", align: "right", firstSort: "desc" },
];

/** One map: the race matchups on it and every player's record. */
export function MapDetail({ map }: { map: MapStats }): ReactElement {
  const mirrors = [
    { name: "Terran mirror", games: map.mirrors.TvT },
    { name: "Zerg mirror", games: map.mirrors.ZvZ },
    { name: "Protoss mirror", games: map.mirrors.PvP },
  ];
  const facts = [
    { label: "Games", value: String(map.games) },
    { label: "Seasons", value: seasonSpan(map.seasons) },
    { label: "Players", value: String(map.players.length) },
  ];
  const rows: DataTableRow[] = map.players.map((p) => ({
    id: p.player,
    cells: {
      player: <PlayerLink name={p.player} />,
      race: <RaceBadge race={p.race} />,
      played: p.wins + p.losses,
      record: `${p.wins}–${p.losses}`,
      rate: formatPercent(p.wins / (p.wins + p.losses)),
    },
    sort: {
      player: p.player,
      race: p.race,
      played: p.wins + p.losses,
      rate: p.wins / (p.wins + p.losses),
    },
  }));

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

      <section aria-labelledby="map-races" className="flex flex-col gap-3">
        <h2 id="map-races">Race against race</h2>
        <div className="card overflow-x-auto">
          <table
            aria-label="Games between the races on this map"
            className="w-full border-collapse text-data tabular-nums"
          >
            <thead className="bg-table-head">
              <tr>
                <th scope="col" className="px-2 py-1 text-left">
                  Matchup
                </th>
                <th scope="col" className="px-2 py-1 text-right">
                  Games
                </th>
                <th scope="col" className="px-2 py-1 text-left">
                  Result
                </th>
              </tr>
            </thead>
            <tbody>
              {map.matchups.map((m) => {
                const games = m.wins + m.losses;
                return (
                  <tr key={matchupKey(m)} className="border-t border-line">
                    <th scope="row" className="px-2 py-1 text-left font-normal">
                      <span className="inline-flex items-center gap-1.5">
                        <RaceBadge race={m.race} display="name" /> vs{" "}
                        <RaceBadge race={m.vs} display="name" />
                      </span>
                    </th>
                    <td className="px-2 py-1 text-right">{games}</td>
                    <td className="px-2 py-1">
                      {games === 0
                        ? "–"
                        : `${RACE_NAMES[m.race]} won ${m.wins}, ${RACE_NAMES[m.vs]} won ${m.losses} (${formatPercent(m.winRate)} ${RACE_NAMES[m.race]})`}
                    </td>
                  </tr>
                );
              })}
              {mirrors.map((m) => (
                <tr key={m.name} className="border-t border-line">
                  <th scope="row" className="px-2 py-1 text-left font-normal">
                    {m.name}
                  </th>
                  <td className="px-2 py-1 text-right">{m.games}</td>
                  <td className="px-2 py-1">–</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-caption text-ink-muted">
          A handful of games says little about a map. Treat anything under about 20 games in a
          matchup as a curiosity.
          {map.unknownRace > 0
            ? ` ${map.unknownRace} more ${map.unknownRace === 1 ? "game involves" : "games involve"} a player whose race is not known.`
            : ""}
        </p>
      </section>

      <section aria-labelledby="map-players" className="flex flex-col gap-3">
        <h2 id="map-players">Players</h2>
        <DataTable
          caption={`${rows.length} players with a game here, most games first. Select a column to sort.`}
          columns={PLAYER_COLUMNS}
          rows={rows}
          initialSort={{ key: "played", dir: "desc" }}
        />
      </section>

      <p className="text-caption text-ink-muted">
        Played in{" "}
        {map.seasons.map((n, i) => (
          <span key={n}>
            {i > 0 ? ", " : ""}
            <Link href={`/seasons/${n}`}>{formatSeason(n)}</Link>
          </span>
        ))}
        . <Link href="/maps">All maps</Link>
      </p>
    </div>
  );
}
