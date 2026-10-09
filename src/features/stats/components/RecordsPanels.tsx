import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

import { getPlayerStats, getRecords } from "@/lib/services/stats";
import type { PlayerStats, Records } from "@/lib/services/stats";
import {
  formatElo,
  formatInteger,
  formatKrw,
  formatPercent,
  formatScore,
  formatSeason,
} from "@/lib/utils/format";

import { DataTable } from "@/components/DataTable";
import type { DataTableColumn, DataTableRow } from "@/components/DataTable";
import { RaceBadge } from "@/components/RaceBadge";

import { PlayerLink } from "./PlayerLink";
import { roundLabel } from "./series-text";

/** Players listed in each career card and each age list. */
const TOP = 5;
/** Games a player needs before their win rate is ranked. */
const MIN_GAMES_FOR_RATE = 50;

type Cell = { key: string; node: ReactNode; align?: "right" };

/** A small fixed table: these lists are already in their one meaningful order. */
function RankedTable({
  label,
  head,
  rows,
}: {
  label: string;
  head: readonly { text: string; align?: "right" }[];
  rows: readonly { id: string; cells: readonly Cell[] }[];
}): ReactElement {
  return (
    <div className="card overflow-x-auto">
      <table aria-label={label} className="w-full border-collapse text-data tabular-nums">
        <thead className="bg-table-head">
          <tr>
            <th scope="col" className="w-8 px-2 py-1 text-right">
              #
            </th>
            {head.map((h, i) => (
              <th
                key={i}
                scope="col"
                className={`px-2 py-1 ${h.align === "right" ? "text-right" : "text-left"}`}
              >
                {h.text}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} className="border-t border-line">
              <td className="px-2 py-1 text-right text-ink-muted">{i + 1}</td>
              {row.cells.map((c) => (
                <td key={c.key} className={`px-2 py-1 ${c.align === "right" ? "text-right" : ""}`}>
                  {c.node}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Who({ player, race }: { player: string; race: PlayerStats["race"] }): ReactElement {
  return (
    <span className="inline-flex items-center gap-2">
      <RaceBadge race={race} />
      <PlayerLink name={player} />
    </span>
  );
}

function seasons(from: number, to: number): ReactNode {
  return from === to ? formatSeason(from) : `${formatSeason(from)} to ${formatSeason(to)}`;
}

function Streaks({
  label,
  unit,
  rows,
}: {
  label: string;
  unit: string;
  rows: Records["gameStreaks"];
}): ReactElement {
  return (
    <RankedTable
      label={label}
      head={[{ text: "Player" }, { text: unit, align: "right" }, { text: "Seasons" }]}
      rows={rows.map((r, i) => ({
        id: `${r.player}-${r.fromSeason}-${i}`,
        cells: [
          { key: "who", node: <Who player={r.player} race={r.race} /> },
          { key: "n", node: <strong>{r.length}</strong>, align: "right" },
          {
            key: "when",
            node: (
              <>
                {seasons(r.fromSeason, r.toSeason)}
                {r.active ? <span className="text-ink-muted"> (still going)</span> : null}
              </>
            ),
          },
        ],
      }))}
    />
  );
}

function age(a: Records["championAges"][number]): string {
  return `${a.years} years, ${a.extraDays} ${a.extraDays === 1 ? "day" : "days"}`;
}

function Ages({ label, rows }: { label: string; rows: Records["championAges"] }): ReactElement {
  return (
    <RankedTable
      label={label}
      head={[{ text: "Champion" }, { text: "Season" }, { text: "Age on the day", align: "right" }]}
      rows={rows.map((a) => ({
        id: `${a.player}-${a.season}`,
        cells: [
          { key: "who", node: <Who player={a.player} race={a.race} /> },
          { key: "s", node: <Link href={`/seasons/${a.season}`}>{formatSeason(a.season)}</Link> },
          { key: "age", node: age(a), align: "right" },
        ],
      }))}
    />
  );
}

type Career = {
  title: string;
  /** Sort value, highest first. */
  value: (p: PlayerStats) => number;
  show: (p: PlayerStats) => string;
  eligible?: (p: PlayerStats) => boolean;
};

const games = (p: PlayerStats): number => p.gamesWon + p.gamesLost;

const CAREER: readonly Career[] = [
  { title: "Most championships", value: (p) => p.championships, show: (p) => `${p.championships}` },
  { title: "Most finals", value: (p) => p.finals, show: (p) => `${p.finals}` },
  { title: "Most seasons entered", value: (p) => p.seasons, show: (p) => `${p.seasons}` },
  { title: "Most games won", value: (p) => p.gamesWon, show: (p) => formatInteger(p.gamesWon) },
  {
    title: `Best game win rate (${MIN_GAMES_FOR_RATE} games or more)`,
    value: (p) => p.gamesWon / Math.max(1, games(p)),
    show: (p) => `${formatPercent(p.gamesWon / games(p))} (${p.gamesWon}–${p.gamesLost})`,
    eligible: (p) => games(p) >= MIN_GAMES_FOR_RATE,
  },
  { title: "Most prize money", value: (p) => p.prizeKrw, show: (p) => formatKrw(p.prizeKrw) },
];

function CareerCard({ career }: { career: Career }): ReactElement {
  const best = getPlayerStats()
    .filter((p) => career.eligible?.(p) ?? true)
    .sort((a, b) => career.value(b) - career.value(a) || a.player.localeCompare(b.player))
    .slice(0, TOP);
  return (
    <section aria-label={career.title} className="card flex flex-col gap-2 p-3">
      <h3 className="text-body font-semibold">{career.title}</h3>
      <ol className="flex flex-col gap-1 text-data">
        {best.map((p, i) => (
          <li key={p.player} className="flex items-baseline gap-2">
            <span className="w-4 text-right text-ink-muted tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">
              <PlayerLink name={p.player} />
            </span>
            <strong className="tabular-nums">{career.show(p)}</strong>
          </li>
        ))}
      </ol>
    </section>
  );
}

const RUN_COLUMNS: DataTableColumn[] = [
  { key: "season", header: "Season", firstSort: "desc" },
  { key: "champion", header: "Champion" },
  { key: "record", header: "Games W–L", align: "right", sortable: false },
  { key: "lost", header: "Games lost", align: "right" },
  { key: "rate", header: "Win rate", align: "right", firstSort: "desc" },
];

/** The records page: streaks, upsets, title runs, champions by age, career leaders. */
export function RecordsPanels(): ReactElement {
  const records = getRecords();
  const byAge = [...records.championAges].sort((a, b) => a.days - b.days);
  const runs: DataTableRow[] = records.titleRuns.map((r) => ({
    id: String(r.season),
    cells: {
      season: <Link href={`/seasons/${r.season}`}>{formatSeason(r.season)}</Link>,
      champion: <Who player={r.player} race={r.race} />,
      record: `${r.gamesWon}–${r.gamesLost}`,
      lost: r.gamesLost,
      rate: formatPercent(r.winRate),
    },
    sort: { season: r.season, champion: r.player, lost: r.gamesLost, rate: r.winRate },
  }));

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="rec-career" className="flex flex-col gap-3">
        <h2 id="rec-career">Career leaders</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {CAREER.map((c) => (
            <CareerCard key={c.title} career={c} />
          ))}
        </div>
      </section>

      <section aria-labelledby="rec-streaks" className="flex flex-col gap-3">
        <h2 id="rec-streaks">Longest winning streaks</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3>Series in a row</h3>
            <Streaks label="Most series won in a row" unit="Series" rows={records.seriesStreaks} />
          </div>
          <div className="flex flex-col gap-2">
            <h3>Games in a row</h3>
            <Streaks label="Most games won in a row" unit="Games" rows={records.gameStreaks} />
          </div>
        </div>
        <p className="text-caption text-ink-muted">
          Group stage and playoffs, across seasons. For some older playoff series Liquipedia gives
          only the score, so the order of the games inside them is a best guess and a game streak
          through one of those could be a game longer or shorter.
        </p>
      </section>

      <section aria-labelledby="rec-upsets" className="flex flex-col gap-3">
        <h2 id="rec-upsets">Biggest upsets</h2>
        <p className="text-caption text-ink-muted">
          Series won by the lower rated player, by the gap in ELO going in.
        </p>
        <RankedTable
          label="Biggest upsets by ELO gap"
          head={[
            { text: "Winner" },
            { text: "ELO", align: "right" },
            { text: "Beat" },
            { text: "ELO", align: "right" },
            { text: "Gap", align: "right" },
            { text: "Where" },
          ]}
          rows={records.upsets.map((u, i) => ({
            id: `${u.season}-${u.winner}-${u.loser}-${i}`,
            cells: [
              { key: "w", node: <Who player={u.winner} race={u.winnerRace} /> },
              { key: "we", node: formatElo(u.winnerElo), align: "right" },
              { key: "l", node: <Who player={u.loser} race={u.loserRace} /> },
              { key: "le", node: formatElo(u.loserElo), align: "right" },
              {
                key: "gap",
                node: <strong>{formatElo(u.loserElo - u.winnerElo)}</strong>,
                align: "right",
              },
              {
                key: "where",
                node: (
                  <>
                    <Link href={`/seasons/${u.season}`}>{formatSeason(u.season)}</Link>{" "}
                    <span className="text-ink-muted">
                      {roundLabel(u)}
                      {u.score ? `, ${formatScore(u.score)}` : ""}
                    </span>
                  </>
                ),
              },
            ],
          }))}
        />
      </section>

      <section aria-labelledby="rec-runs" className="flex flex-col gap-3">
        <h2 id="rec-runs">Title runs</h2>
        <DataTable
          caption="Every champion's games in the season they won. Select a column to sort."
          columns={RUN_COLUMNS}
          rows={runs}
          initialSort={{ key: "rate", dir: "desc" }}
        />
      </section>

      {byAge.length > 0 ? (
        <section aria-labelledby="rec-ages" className="flex flex-col gap-3">
          <h2 id="rec-ages">Youngest and oldest champions</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <h3>Youngest</h3>
              <Ages label="Youngest champions" rows={byAge.slice(0, TOP)} />
            </div>
            <div className="flex flex-col gap-2">
              <h3>Oldest</h3>
              <Ages label="Oldest champions" rows={byAge.slice(-TOP).reverse()} />
            </div>
          </div>
          <p className="text-caption text-ink-muted">
            Age on the day of the final, from the birth dates on Liquipedia.
          </p>
        </section>
      ) : null}
    </div>
  );
}
