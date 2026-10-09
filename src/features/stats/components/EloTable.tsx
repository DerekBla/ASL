import type { ReactElement } from "react";

import { getElo } from "@/lib/services/stats";
import { formatElo, formatSeason } from "@/lib/utils/format";

import { DataTable } from "@/components/DataTable";
import type { DataTableColumn, DataTableRow } from "@/components/DataTable";
import { RaceBadge } from "@/components/RaceBadge";

import { PlayerLink } from "./PlayerLink";

const COLUMNS: DataTableColumn[] = [
  { key: "rank", header: "Rank", align: "right" },
  { key: "player", header: "Player" },
  { key: "race", header: "Race", align: "center" },
  { key: "current", header: "Current ELO", align: "right", firstSort: "desc" },
  { key: "peak", header: "Peak ELO", align: "right", firstSort: "desc" },
  { key: "peakSeason", header: "Peak season", align: "right" },
  { key: "games", header: "Games", align: "right", firstSort: "desc" },
  { key: "seasons", header: "Seasons", align: "right", firstSort: "desc" },
  { key: "titles", header: "Championships", align: "right", firstSort: "desc" },
];

type Props = {
  /** Show the rating that also counts qualifier games, ranked by it. */
  withQualifiers?: boolean;
};

export function EloTable({ withQualifiers = false }: Props): ReactElement {
  const rows: DataTableRow[] = getElo()
    .map((row) => (withQualifiers ? { ...row, ...row.withQualifiers } : row))
    .sort((a, b) => a.rank - b.rank)
    .map((r) => ({
      id: r.player,
      cells: {
        rank: r.rank,
        player: <PlayerLink name={r.player} />,
        race: <RaceBadge race={r.race} />,
        current: <strong>{formatElo(r.currentElo)}</strong>,
        peak: formatElo(r.peakElo),
        peakSeason: formatSeason(r.peakSeason),
        games: r.games,
        seasons: r.seasons,
        titles: r.championships,
      },
      sort: {
        rank: r.rank,
        player: r.player,
        race: r.race,
        current: r.currentElo,
        peak: r.peakElo,
        peakSeason: r.peakSeason,
        games: r.games,
        seasons: r.seasons,
        titles: r.championships,
      },
    }));
  return (
    <DataTable
      caption={
        withQualifiers
          ? "All players by current ELO, qualifier games included. Select a column to sort."
          : "All players by current ELO. Select a column to sort."
      }
      columns={COLUMNS}
      rows={rows}
      initialSort={{ key: "rank", dir: "asc" }}
    />
  );
}
