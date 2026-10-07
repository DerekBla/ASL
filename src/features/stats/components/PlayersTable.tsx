import type { ReactElement } from "react";

import { getPlayerStats } from "@/lib/services/stats";
import { formatElo, formatKrw } from "@/lib/utils/format";

import { DataTable } from "@/components/DataTable";
import type { DataTableColumn, DataTableRow } from "@/components/DataTable";
import { PlacementBadge } from "@/components/PlacementBadge";
import { RaceBadge } from "@/components/RaceBadge";

import { PlayerLink } from "./PlayerLink";

const COLUMNS: DataTableColumn[] = [
  { key: "player", header: "Player" },
  { key: "race", header: "Race", align: "center" },
  { key: "seasons", header: "Seasons", align: "right", firstSort: "desc" },
  { key: "best", header: "Best finish" },
  { key: "titles", header: "Titles", align: "right", firstSort: "desc" },
  { key: "finals", header: "Finals", align: "right", firstSort: "desc" },
  { key: "semis", header: "Top 4", align: "right", firstSort: "desc" },
  { key: "prize", header: "Prize money", align: "right", firstSort: "desc" },
  { key: "elo", header: "ELO", align: "right", firstSort: "desc" },
];

export function PlayersTable(): ReactElement {
  const rows: DataTableRow[] = getPlayerStats().map((p) => ({
    id: p.player,
    cells: {
      player: <PlayerLink name={p.player} />,
      race: <RaceBadge race={p.race} />,
      seasons: p.seasons,
      best: <PlacementBadge placement={p.bestFinish} />,
      titles: p.championships,
      finals: p.finals,
      semis: p.semifinalsOrBetter,
      prize: formatKrw(p.prizeKrw),
      elo: formatElo(p.currentElo),
    },
    sort: {
      player: p.player,
      race: p.race,
      seasons: p.seasons,
      best: p.bestFinish.best * 100 + p.bestFinish.worst,
      titles: p.championships,
      finals: p.finals,
      semis: p.semifinalsOrBetter,
      prize: p.prizeKrw,
      elo: p.currentElo,
    },
  }));
  return (
    <DataTable
      caption={`${rows.length} players who have entered an ASL season. Select a column to sort.`}
      columns={COLUMNS}
      rows={rows}
      initialSort={{ key: "player", dir: "asc" }}
    />
  );
}
