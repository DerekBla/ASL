import Link from "next/link";
import type { ReactElement } from "react";

import { getElo, getManifest, MIN_MATCHUP_GAMES } from "@/lib/services/stats";
import type { EloRow } from "@/lib/services/stats";
import { RACE_NAMES, RACES } from "@/lib/types/race";
import type { Race } from "@/lib/types/race";
import { formatElo, formatInteger } from "@/lib/utils/format";

import { DataTable } from "@/components/DataTable";
import type { DataTableColumn, DataTableRow } from "@/components/DataTable";
import { RaceBadge } from "@/components/RaceBadge";

import { PlayerLink } from "./PlayerLink";

/** Players listed in each "best at this matchup" card. */
const TOP = 5;

const COLUMNS: DataTableColumn[] = [
  { key: "player", header: "Player" },
  { key: "race", header: "Race", align: "center" },
  { key: "overall", header: "Overall ELO", align: "right", firstSort: "desc" },
  ...RACES.map((r) => ({
    key: `elo${r}`,
    header: `vs ${RACE_NAMES[r]}`,
    align: "right" as const,
    firstSort: "desc" as const,
  })),
];

/** A matchup rating the site is willing to rank: enough games behind it. */
function rated(row: EloRow, vs: Race): number | null {
  const m = row.vsRace[vs];
  return m.games >= MIN_MATCHUP_GAMES ? m.elo : null;
}

function TopCard({ race, vs }: { race: Race; vs: Race }): ReactElement {
  const best = getElo()
    .filter((row) => row.race === race && rated(row, vs) !== null)
    .sort((a, b) => (rated(b, vs) ?? 0) - (rated(a, vs) ?? 0) || a.player.localeCompare(b.player))
    .slice(0, TOP);
  const title =
    race === vs ? `${RACE_NAMES[race]} mirror` : `${RACE_NAMES[race]} vs ${RACE_NAMES[vs]}`;
  return (
    <section aria-label={title} className="card flex flex-col gap-2 p-3">
      <h3 className="flex flex-wrap items-center gap-1.5 text-body font-semibold">
        <RaceBadge race={race} display="name" />
        {race === vs ? "mirror" : "vs"}
        {race === vs ? null : <RaceBadge race={vs} display="name" />}
      </h3>
      {best.length === 0 ? (
        <p className="text-caption text-ink-muted">Nobody has {MIN_MATCHUP_GAMES} games yet.</p>
      ) : (
        <ol className="flex flex-col gap-1 text-data">
          {best.map((row, i) => {
            const m = row.vsRace[vs];
            return (
              <li key={row.player} className="flex items-baseline gap-2">
                <span className="w-4 text-right text-ink-muted tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">
                  <PlayerLink name={row.player} />
                </span>
                <strong className="tabular-nums">{formatElo(m.elo ?? 0)}</strong>
                <span className="w-14 text-right text-caption text-ink-muted tabular-nums">
                  {m.wins}–{m.games - m.wins}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/**
 * ELO by matchup: who is best at each of the nine race pairings, then every player's three
 * matchup ratings. Computed by compute_matchup_elo in the exporter, from ASL games only.
 */
export function MatchupRatings(): ReactElement {
  const { elo } = getManifest();
  const rows: DataTableRow[] = getElo().map((row) => ({
    id: row.player,
    cells: {
      player: <PlayerLink name={row.player} />,
      race: <RaceBadge race={row.race} />,
      overall: formatElo(row.currentElo),
      ...Object.fromEntries(
        RACES.map((r) => {
          const value = rated(row, r);
          const games = row.vsRace[r].games;
          return [
            `elo${r}`,
            <span key={r} className="inline-flex items-baseline justify-end gap-2">
              {value === null ? null : <strong>{formatElo(value)}</strong>}
              <span className="text-caption text-ink-muted">
                {games} {games === 1 ? "game" : "games"}
              </span>
            </span>,
          ];
        }),
      ),
    },
    sort: {
      player: row.player,
      race: row.race,
      overall: row.currentElo,
      ...Object.fromEntries(RACES.map((r) => [`elo${r}`, rated(row, r)])),
    },
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1>ELO by matchup</h1>
        <p className="text-ink-muted">
          The <Link href="/elo">overall ELO</Link> puts every game in one number. Here each matchup
          is rated on its own: a Terran&apos;s rating against Zerg counts only games against Zerg
          players, and so on. Every rating starts at {formatInteger(elo.start)} and moves the same
          way (K = {elo.k}). ASL games only.
        </p>
        <p className="text-caption text-ink-muted">
          A matchup rating is shown once a player has {MIN_MATCHUP_GAMES} games in it. These rest on
          far fewer games than the overall rating, so small gaps mean little.
        </p>
      </header>

      <section aria-labelledby="matchup-best" className="flex flex-col gap-3">
        <h2 id="matchup-best">Best in each matchup</h2>
        <p className="text-caption text-ink-muted">
          Rating, then games won and lost in the matchup.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {RACES.map((race) => (
            <div key={race} className="flex flex-col gap-3">
              {RACES.map((vs) => (
                <TopCard key={vs} race={race} vs={vs} />
              ))}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="matchup-all" className="flex flex-col gap-3">
        <h2 id="matchup-all">All players</h2>
        <DataTable
          caption={`Each player's rating against each race, with the games behind it. No rating is shown under ${MIN_MATCHUP_GAMES} games. Select a column to sort.`}
          columns={COLUMNS}
          rows={rows}
          initialSort={{ key: "overall", dir: "desc" }}
        />
      </section>
    </div>
  );
}
