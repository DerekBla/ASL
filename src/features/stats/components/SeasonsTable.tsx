import Link from "next/link";
import type { ReactElement } from "react";

import { getSeasons } from "@/lib/services/stats";
import { formatDateRange, formatKrw, formatScore, formatSeason } from "@/lib/utils/format";

import { DataTable } from "@/components/DataTable";
import type { DataTableColumn, DataTableRow } from "@/components/DataTable";
import { RaceBadge } from "@/components/RaceBadge";

import { PlayerLink } from "./PlayerLink";

const COLUMNS: DataTableColumn[] = [
  { key: "season", header: "Season", firstSort: "desc" },
  { key: "dates", header: "Dates", sortable: false },
  { key: "champion", header: "Champion" },
  { key: "runnerUp", header: "Runner up" },
  { key: "score", header: "Final", align: "center", sortable: false },
  { key: "prize", header: "Prize pool", align: "right", firstSort: "desc" },
];

export function SeasonsTable(): ReactElement {
  const rows: DataTableRow[] = getSeasons().map((s) => ({
    id: String(s.season),
    cells: {
      season: <Link href={`/seasons/${s.season}`}>{`${formatSeason(s.season)} · ${s.name}`}</Link>,
      dates: formatDateRange(s.start, s.end),
      champion: s.winner ? (
        <span className="inline-flex items-center gap-2">
          <RaceBadge race={s.winnerRace} />
          <PlayerLink name={s.winner} />
        </span>
      ) : (
        "In progress"
      ),
      runnerUp: s.runnerUp ? (
        <span className="inline-flex items-center gap-2">
          <RaceBadge race={s.runnerUpRace} />
          <PlayerLink name={s.runnerUp} />
        </span>
      ) : (
        "–"
      ),
      score: formatScore(s.finalScore),
      prize: formatKrw(s.prizePoolKrw),
    },
    sort: {
      season: s.season,
      champion: s.winner,
      runnerUp: s.runnerUp,
      prize: s.prizePoolKrw,
    },
  }));
  return (
    <DataTable
      caption="Every ASL season, newest first"
      columns={COLUMNS}
      rows={rows}
      initialSort={{ key: "season", dir: "desc" }}
    />
  );
}
