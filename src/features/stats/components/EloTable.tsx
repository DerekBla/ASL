import type { ReactElement } from "react";

import { getElo } from "@/lib/services/stats";
import { formatElo, formatSeason } from "@/lib/utils/format";

import { DataTable } from "@/components/DataTable";
import type { DataTableColumn, DataTableRow } from "@/components/DataTable";
import { RaceBadge } from "@/components/RaceBadge";

import { PlayerLink } from "./PlayerLink";

// Same columns as the old spreadsheet's ELO Ratings tab.
const COLUMNS: DataTableColumn[] = [
  { key: "rank", header: "Rank", align: "right" },
  { key: "player", header: "Player" },
  { key: "race", header: "Race", align: "center" },
  { key: "current", header: "Current ELO", align: "right", firstSort: "desc" },
  { key: "peak", header: "Peak ELO", align: "right", firstSort: "desc" },
  { key: "peakSeason", header: "Peak season", align: "right" },
  { key: "seasons", header: "Seasons", align: "right", firstSort: "desc" },
  { key: "titles", header: "Championships", align: "right", firstSort: "desc" },
];

export function EloTable(): ReactElement {
  const rows: DataTableRow[] = getElo().map((r) => ({
    id: r.player,
    cells: {
      rank: r.rank,
      player: <PlayerLink name={r.player} />,
      race: <RaceBadge race={r.race} />,
      current: <strong>{formatElo(r.currentElo)}</strong>,
      peak: formatElo(r.peakElo),
      peakSeason: formatSeason(r.peakSeason),
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
      seasons: r.seasons,
      titles: r.championships,
    },
  }));
  return (
    <DataTable
      caption="All players by current ELO. Select a column to sort."
      columns={COLUMNS}
      rows={rows}
      initialSort={{ key: "rank", dir: "asc" }}
    />
  );
}
