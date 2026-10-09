import Link from "next/link";
import type { ReactElement } from "react";

import { seriesWinProbability } from "@/lib/market/priors";
import { getManifest, getPlayers, getWinChance } from "@/lib/services/stats";
import type { HeadToHead as HeadToHeadData } from "@/lib/services/stats";
import { formatElo, formatProbability, formatScore, formatSeason } from "@/lib/utils/format";

import { Button } from "@/components/Button";
import { PlacementBadge } from "@/components/PlacementBadge";
import { RaceBadge } from "@/components/RaceBadge";

import { PlayerLink } from "./PlayerLink";
import { PLAYOFF_ROUND_LABEL as ROUND, STAGE_LABEL as STAGE } from "./series-text";

/** Series lengths the ASL uses, for the chances table. */
const LENGTHS = [
  { bestOf: 1, label: "One game" },
  { bestOf: 3, label: "Best of 3" },
  { bestOf: 5, label: "Best of 5" },
  { bestOf: 7, label: "Best of 7" },
] as const;

/**
 * What the ratings say would happen if the two played now, for each series length the ASL
 * uses. The chance of one game is scaled to how ASL games have gone (see getWinChance).
 */
function Chances({ h2h }: { h2h: HeadToHeadData }): ReactElement | null {
  const { a, b } = h2h;
  const chance = getWinChance(a.player, b.player);
  if (!chance) return null;
  const { favoriteGames, favoriteWins } = getManifest().elo;
  const sides = [
    { player: a.player, elo: chance.eloA, game: chance.game },
    { player: b.player, elo: chance.eloB, game: 1 - chance.game },
  ];
  return (
    <section aria-labelledby="h2h-chances" className="flex flex-col gap-2">
      <h3 id="h2h-chances">If they played now</h3>
      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-data tabular-nums">
          <caption className="px-2 py-1.5 text-left text-caption text-ink-muted">
            Each player&apos;s chance of winning, from their current ELO.
          </caption>
          <thead className="bg-table-head">
            <tr>
              <th scope="col" className="px-2 py-1 text-left">
                Player
              </th>
              <th scope="col" className="px-2 py-1 text-right">
                ELO
              </th>
              {LENGTHS.map((l) => (
                <th key={l.bestOf} scope="col" className="px-2 py-1 text-right">
                  {l.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sides.map((side) => (
              <tr key={side.player} className="border-t border-line">
                <th scope="row" className="px-2 py-1 text-left font-normal">
                  {side.player}
                </th>
                <td className="px-2 py-1 text-right">{formatElo(side.elo)}</td>
                {LENGTHS.map((l) => (
                  <td key={l.bestOf} className="px-2 py-1 text-right">
                    <strong>{formatProbability(seriesWinProbability(side.game, l.bestOf))}</strong>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-caption text-ink-muted">
        A rough guide, not a forecast. ELO knows results and nothing about matchups, maps, form or
        preparation, and it is a weak predictor in the ASL: across every game so far, the higher
        rated player won {formatProbability(favoriteGames > 0 ? favoriteWins / favoriteGames : 0.5)}{" "}
        of the time. The chances are scaled down to match that, so they sit closer to even than the
        usual ELO formula would put them.
      </p>
    </section>
  );
}

type FormProps = {
  a: string;
  b: string;
};

/** Plain GET form: works without JavaScript, and the result URL can be shared. */
export function HeadToHeadForm({ a, b }: FormProps): ReactElement {
  return (
    <form method="get" action="/head-to-head" className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-caption text-ink-muted">Player 1</span>
        <input
          name="a"
          list="player-names"
          defaultValue={a}
          required
          autoComplete="off"
          className="field"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-caption text-ink-muted">Player 2</span>
        <input
          name="b"
          list="player-names"
          defaultValue={b}
          required
          autoComplete="off"
          className="field"
        />
      </label>
      <Button type="submit">Compare</Button>
      <datalist id="player-names">
        {getPlayers().map((p) => (
          <option key={p.player} value={p.player} />
        ))}
      </datalist>
    </form>
  );
}

type ResultProps = {
  h2h: HeadToHeadData;
};

export function HeadToHeadResult({ h2h }: ResultProps): ReactElement {
  const { a, b } = h2h;
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="h2h-summary" className="flex flex-col gap-2">
        <h2 id="h2h-summary" className="flex flex-wrap items-center gap-2">
          <RaceBadge race={a.race} />
          <PlayerLink name={a.player} />
          <span className="tabular-nums">
            {h2h.winsA}–{h2h.winsB}
          </span>
          <PlayerLink name={b.player} />
          <RaceBadge race={b.race} />
        </h2>
        <p className="text-ink-muted">
          {h2h.series.length === 0
            ? "They have never met in an ASL series."
            : `${h2h.series.length} ASL series between them, group stage and playoffs.`}{" "}
          In the {h2h.sharedSeasons.length} seasons both entered, {a.player} finished ahead{" "}
          {h2h.finishedAboveA} times and {b.player} {h2h.finishedAboveB} times.
        </p>
      </section>

      <Chances h2h={h2h} />

      {h2h.series.length > 0 ? (
        <section aria-labelledby="h2h-series" className="flex flex-col gap-2">
          <h3 id="h2h-series">Every series</h3>
          <ol className="flex flex-col gap-1">
            {h2h.series.map((s, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <Link href={`/seasons/${s.season}`} className="tabular-nums">
                  {formatSeason(s.season)}
                </Link>
                <span className="text-ink-muted">
                  {STAGE[s.stage]}
                  {s.stage === "playoffs" ? ` · ${ROUND[s.round] ?? s.round}` : ` · ${s.round}`}
                </span>
                <span>
                  <strong>{s.winner}</strong> won{s.score ? ` ${formatScore(s.score)}` : ""}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {h2h.sharedSeasons.length > 0 ? (
        <section aria-labelledby="h2h-seasons" className="flex flex-col gap-2">
          <h3 id="h2h-seasons">Seasons both entered</h3>
          <table className="w-full max-w-xl border-collapse text-data">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="px-2 py-1 text-left">
                  Season
                </th>
                <th scope="col" className="px-2 py-1 text-left">
                  {a.player}
                </th>
                <th scope="col" className="px-2 py-1 text-left">
                  {b.player}
                </th>
              </tr>
            </thead>
            <tbody>
              {h2h.sharedSeasons.map((x) => (
                <tr key={x.season} className="border-b border-line last:border-b-0">
                  <td className="px-2 py-1">
                    <Link href={`/seasons/${x.season}`}>{formatSeason(x.season)}</Link>
                  </td>
                  <td className="px-2 py-1">
                    <PlacementBadge placement={x.a.placement} />
                  </td>
                  <td className="px-2 py-1">
                    <PlacementBadge placement={x.b.placement} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
