import Link from "next/link";
import type { ReactElement } from "react";

import { maxPoints, totalPicks } from "@/lib/pickem/bracket";
import type { PickemView, StandingRow } from "@/lib/services/pickem";
import { formatPercent } from "@/lib/utils/format";

import { DataTable } from "@/components/DataTable";
import type { DataTableColumn, DataTableRow } from "@/components/DataTable";

import { AchievementList } from "./AchievementList";

type Props = {
  pickem: PickemView;
  rows: readonly StandingRow[];
  /** The signed in reader, to mark their own row. */
  viewerId?: string | undefined;
};

const OPEN_COLUMNS: DataTableColumn[] = [
  { key: "name", header: "Player" },
  { key: "picks", header: "Picks made", align: "right", firstSort: "desc" },
];

const SCORED_COLUMNS: DataTableColumn[] = [
  { key: "rank", header: "Rank", align: "right" },
  { key: "name", header: "Player" },
  { key: "points", header: "Points", align: "right", firstSort: "desc" },
  { key: "accuracy", header: "Accuracy", align: "right", firstSort: "desc" },
  { key: "correct", header: "Right", align: "right", firstSort: "desc" },
  { key: "wrong", header: "Wrong", align: "right", firstSort: "desc" },
  { key: "possible", header: "Best possible", align: "right", firstSort: "desc" },
  { key: "champion", header: "Champion pick" },
  { key: "achievements", header: "Achievements", firstSort: "desc" },
];

/** Every bracket in a season. Sortable, so readers can rank by points or by accuracy. */
export function StandingsTable({ pickem, rows, viewerId }: Props): ReactElement {
  if (rows.length === 0) return <p className="text-ink-muted">No brackets yet.</p>;
  const open = pickem.status === "open";
  const total = totalPicks(pickem.config);

  const tableRows: DataTableRow[] = rows.map((r) => {
    const name = (
      <>
        <Link href={`/pickem/${pickem.season}/brackets/${r.entryId}`}>{r.displayName}</Link>
        {r.userId === viewerId ? <span className="text-ink-muted"> (you)</span> : null}
      </>
    );
    return {
      id: String(r.entryId),
      cells: {
        rank: r.rank,
        name,
        picks: `${r.picksMade} of ${total}`,
        points: <strong>{r.score.points}</strong>,
        accuracy: formatPercent(r.score.accuracy),
        correct: r.score.correct,
        wrong: r.score.wrong,
        possible: r.score.possible,
        champion: r.championPick ?? "–",
        achievements: <AchievementList achievements={r.achievements} display="compact" />,
      },
      sort: {
        rank: r.rank,
        name: r.displayName,
        picks: r.picksMade,
        points: r.score.points,
        accuracy: r.score.accuracy,
        correct: r.score.correct,
        wrong: r.score.wrong,
        possible: r.score.possible,
        champion: r.championPick,
        achievements: r.achievements.length,
      },
    };
  });

  return open ? (
    <DataTable
      caption="Brackets stay hidden until the pick'em locks."
      columns={OPEN_COLUMNS}
      rows={tableRows}
      initialSort={{ key: "name", dir: "asc" }}
    />
  ) : (
    <DataTable
      caption={`Out of ${maxPoints(pickem.config)} points. Accuracy is right picks out of decided picks; a pick left blank counts as a miss.`}
      columns={SCORED_COLUMNS}
      rows={tableRows}
      initialSort={{ key: "rank", dir: "asc" }}
    />
  );
}
