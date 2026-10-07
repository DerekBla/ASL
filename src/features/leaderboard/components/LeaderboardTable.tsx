import type { ReactElement } from "react";

import type { LeaderboardRow } from "@/lib/services/markets-read";
import { formatMinerals } from "@/lib/utils/format";

import { DataTable } from "@/components/DataTable";
import type { DataTableColumn, DataTableRow } from "@/components/DataTable";

const COLUMNS: DataTableColumn[] = [
  { key: "rank", header: "Rank", align: "right" },
  { key: "name", header: "Player" },
  { key: "netWorth", header: "Net worth", align: "right", firstSort: "desc" },
  { key: "balance", header: "Minerals", align: "right", firstSort: "desc" },
  { key: "positions", header: "In positions", align: "right", firstSort: "desc" },
];

export function LeaderboardTable({ rows }: { rows: readonly LeaderboardRow[] }): ReactElement {
  if (rows.length === 0) return <p className="text-ink-muted">Nobody has signed in yet.</p>;
  const tableRows: DataTableRow[] = rows.map((r) => ({
    id: r.userId,
    cells: {
      rank: r.rank,
      name: r.displayName,
      netWorth: <strong>{formatMinerals(r.netWorth)}</strong>,
      balance: formatMinerals(r.balance),
      positions: formatMinerals(r.positionsValue),
    },
    sort: {
      rank: r.rank,
      name: r.displayName,
      netWorth: r.netWorth,
      balance: r.balance,
      positions: r.positionsValue,
    },
  }));
  return (
    <DataTable
      caption="Net worth is minerals plus open positions at current prices."
      columns={COLUMNS}
      rows={tableRows}
      initialSort={{ key: "rank", dir: "asc" }}
    />
  );
}
