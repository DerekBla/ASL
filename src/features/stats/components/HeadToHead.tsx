import Link from "next/link";
import type { ReactElement } from "react";

import { getPlayers } from "@/lib/services/stats";
import type { HeadToHead as HeadToHeadData } from "@/lib/services/stats";
import { formatScore, formatSeason } from "@/lib/utils/format";

import { Button } from "@/components/Button";
import { PlacementBadge } from "@/components/PlacementBadge";
import { RaceBadge } from "@/components/RaceBadge";

import { PlayerLink } from "./PlayerLink";

const STAGE: Record<string, string> = {
  ro24: "Round of 24",
  ro16: "Round of 16",
  playoffs: "Playoffs",
};
const ROUND: Record<string, string> = {
  final: "Final",
  third_place: "Third-place match",
  semifinal: "Semifinal",
  quarterfinal: "Quarterfinal",
};

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
          className="rounded-md border border-line bg-surface px-3 py-2"
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
          className="rounded-md border border-line bg-surface px-3 py-2"
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
