import type { ReactElement } from "react";

import { getRaceStats } from "@/lib/services/stats";
import type { Matchups } from "@/lib/services/stats";
import { RACE_NAMES, RACES } from "@/lib/types/race";
import { formatPercent, formatSeason } from "@/lib/utils/format";

import { DataTable } from "@/components/DataTable";
import type { DataTableColumn, DataTableRow } from "@/components/DataTable";
import { RaceBadge } from "@/components/RaceBadge";

const OVERALL_COLUMNS: DataTableColumn[] = [
  { key: "race", header: "Race" },
  { key: "titles", header: "Titles", align: "right", firstSort: "desc" },
  { key: "runnerUps", header: "Runner-ups", align: "right", firstSort: "desc" },
  { key: "titleShare", header: "Share of titles", align: "right", firstSort: "desc" },
  { key: "entries", header: "Player-seasons", align: "right", firstSort: "desc" },
  { key: "entryShare", header: "Share of field", align: "right", firstSort: "desc" },
];

const SEASON_COLUMNS: DataTableColumn[] = [
  { key: "season", header: "Season", firstSort: "desc" },
  { key: "T", header: "Terran", align: "right", firstSort: "desc" },
  { key: "Z", header: "Zerg", align: "right", firstSort: "desc" },
  { key: "P", header: "Protoss", align: "right", firstSort: "desc" },
  { key: "champion", header: "Champion race", align: "center" },
];

const MIRROR = { T: "TvT", Z: "ZvZ", P: "PvP" } as const;

function MatchupMatrix({ title, data }: { title: string; data: Matchups }): ReactElement {
  // Each cell is the row race's series record against the column race.
  const cell = (race: string, vs: string): string => {
    const r = data.crossRace.find((x) => x.race === race && x.vs === vs);
    return r ? `${formatPercent(r.winRate)} (${r.wins}–${r.losses})` : "–";
  };
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-data">
        <caption className="px-3 py-2 text-left text-caption text-ink-muted">{title}</caption>
        <thead className="bg-surface-muted">
          <tr>
            <th scope="col" className="px-3 py-2 text-left">
              Race
            </th>
            {RACES.map((r) => (
              <th key={r} scope="col" className="px-3 py-2 text-right">
                vs {RACE_NAMES[r]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RACES.map((race) => (
            <tr key={race} className="border-t border-line">
              <th scope="row" className="px-3 py-1.5 text-left">
                <RaceBadge race={race} display="name" />
              </th>
              {RACES.map((vs) => (
                <td key={vs} className="px-3 py-1.5 text-right tabular-nums">
                  {race === vs ? `${data.mirrors[MIRROR[race]]} mirror series` : cell(race, vs)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RaceStatsPanels(): ReactElement {
  const stats = getRaceStats();
  const overall: DataTableRow[] = stats.overall.map((r) => ({
    id: r.race,
    cells: {
      race: <RaceBadge race={r.race} display="name" />,
      titles: r.championships,
      runnerUps: r.runnerUps,
      titleShare: formatPercent(r.titleShare),
      entries: r.participantSeasons,
      entryShare: formatPercent(r.participantShare),
    },
    sort: {
      race: r.race,
      titles: r.championships,
      runnerUps: r.runnerUps,
      titleShare: r.titleShare,
      entries: r.participantSeasons,
      entryShare: r.participantShare,
    },
  }));
  const champions = new Map(stats.finalsBySeason.map((f) => [f.season, f.championRace]));
  const bySeason: DataTableRow[] = stats.participantsBySeason.map((s) => ({
    id: String(s.season),
    cells: {
      season: formatSeason(s.season),
      T: s.T,
      Z: s.Z,
      P: s.P,
      champion: <RaceBadge race={champions.get(s.season) ?? null} />,
    },
    sort: { season: s.season, T: s.T, Z: s.Z, P: s.P, champion: champions.get(s.season) ?? null },
  }));

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="overall-heading" className="flex flex-col gap-3">
        <h2 id="overall-heading">Titles and representation</h2>
        <DataTable caption="All seasons" columns={OVERALL_COLUMNS} rows={overall} />
      </section>

      <section aria-labelledby="matchups-heading" className="flex flex-col gap-3">
        <h2 id="matchups-heading">Matchups</h2>
        <p className="text-ink-muted">
          Counted in series, not games: a best-of-seven final is one series. Read across a row: the
          row race&apos;s series win rate against the column race.
        </p>
        <MatchupMatrix
          title="All stages (group stages and playoffs)"
          data={stats.seriesByMatchup.allStages}
        />
        <MatchupMatrix title="Playoffs only" data={stats.seriesByMatchup.playoffs} />
        <MatchupMatrix title="Grand finals only" data={stats.seriesByMatchup.finals} />
      </section>

      <section aria-labelledby="seasons-heading" className="flex flex-col gap-3">
        <h2 id="seasons-heading">The field, season by season</h2>
        <DataTable
          caption="Players of each race in each season"
          columns={SEASON_COLUMNS}
          rows={bySeason}
          initialSort={{ key: "season", dir: "desc" }}
        />
      </section>
    </div>
  );
}
