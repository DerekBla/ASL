import Link from "next/link";
import type { ReactElement } from "react";

import { getBuildReplaysByPro } from "@/lib/services/builds";
import type { BuildReplay } from "@/lib/services/builds";
import { getPlayerBySlug } from "@/lib/services/stats";
import { formatDay, formatGameLength } from "@/lib/utils/format";

import { RaceBadge } from "@/components/RaceBadge";

const COLUMNS = [
  { header: "Played", align: "text-left" },
  { header: "Result", align: "text-left" },
  { header: "Matchup", align: "text-left" },
  { header: "Opponent", align: "text-left" },
  { header: "Map", align: "text-left" },
  { header: "Length", align: "text-right" },
  { header: "Build order", align: "text-left" },
  { header: "Replay file", align: "text-left" },
] as const;

function ReplayRow({ replay }: { replay: BuildReplay }): ReactElement {
  const [subject, opponent] = replay.players;
  return (
    <tr>
      <td className="px-2 py-1 whitespace-nowrap">{formatDay(replay.playedAt)}</td>
      <td className="px-2 py-1">{replay.result === "win" ? "Win" : "Loss"}</td>
      <td className="px-2 py-1 whitespace-nowrap">
        <RaceBadge race={subject?.race ?? null} /> <span className="text-ink-muted">vs</span>{" "}
        <RaceBadge race={opponent?.race ?? null} />
      </td>
      <td className="px-2 py-1">
        {opponent?.name}
        {opponent?.pro ? <span className="text-ink-muted"> ({opponent.pro})</span> : null}
      </td>
      <td className="px-2 py-1">{replay.map}</td>
      <td className="px-2 py-1 text-right tabular-nums">
        {formatGameLength(replay.durationSeconds)}
      </td>
      <td className="px-2 py-1 whitespace-nowrap">
        <Link href={`/builds/${replay.id}`} className="font-medium">
          Open
        </Link>
      </td>
      <td className="px-2 py-1 whitespace-nowrap">
        <a href={replay.file} download>
          Download
        </a>
      </td>
    </tr>
  );
}

/** Every stored replay, grouped by the pro it was collected for. */
export function BuildsIndex(): ReactElement {
  const groups = getBuildReplaysByPro();
  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => {
        const headingId = `builds-${group.proSlug}`;
        const known = getPlayerBySlug(group.proSlug);
        return (
          <section key={group.pro} aria-labelledby={headingId} className="flex flex-col gap-3">
            <h2 id={headingId}>{group.pro}</h2>
            {known ? (
              <p className="text-caption text-ink-muted">
                <Link href={`/players/${group.proSlug}`}>{group.pro} in the ASL</Link>
              </p>
            ) : null}
            <div className="card overflow-x-auto">
              <table
                aria-label={`Recent ladder games of ${group.pro}`}
                className="w-full border-collapse text-data [&_td]:border [&_td]:border-line-strong/70 [&_th]:border [&_th]:border-line-strong/70"
              >
                <thead className="bg-table-head">
                  <tr>
                    {COLUMNS.map((column) => (
                      <th key={column.header} scope="col" className={`px-2 py-1 ${column.align}`}>
                        {column.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.replays.map((replay) => (
                    <ReplayRow key={replay.id} replay={replay} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
