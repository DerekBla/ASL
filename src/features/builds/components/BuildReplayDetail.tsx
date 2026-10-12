import Link from "next/link";
import type { ReactElement } from "react";

import { formatFrame } from "@/lib/replay/buildOrder";
import type { BuildPlayer, BuildReplay, BuildStep } from "@/lib/services/builds";
import { findPlayer, playerSlug } from "@/lib/services/stats";
import { formatDay, formatGameLength } from "@/lib/utils/format";

import { RaceBadge } from "@/components/RaceBadge";

/** "Supply Depot", "Supply Depot 2", "Vehicle Weapons level 2". */
export function stepLabel(step: BuildStep): string {
  if (step.count === 1) return step.name;
  return step.kind === "research"
    ? `${step.name} level ${step.count}`
    : `${step.name} ${step.count}`;
}

const KIND_LABELS: Record<BuildStep["kind"], string> = {
  building: "Building",
  unit: "Unit",
  research: "Research",
};

function PlayerBuild({ player, won }: { player: BuildPlayer; won: boolean }): ReactElement {
  const known = player.pro ? findPlayer(player.pro) : undefined;
  return (
    <section aria-label={`Build order of ${player.name}`} className="flex flex-col gap-2">
      <h2 className="flex flex-wrap items-center gap-2">
        <RaceBadge race={player.race} />
        {player.pro ?? player.name}
        <span className="text-caption font-normal text-ink-muted">{won ? "Won" : "Lost"}</span>
      </h2>
      <p className="text-caption text-ink-muted">
        {player.pro ? <>Playing as {player.name}. </> : null}
        {player.start > 0 ? <>Started at {player.start} o&apos;clock. </> : null}
        {player.apm} actions a minute.
        {known ? (
          <>
            {" "}
            <Link href={`/players/${playerSlug(known.player)}`}>{known.player} in the ASL</Link>
          </>
        ) : null}
      </p>
      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-data [&_td]:border [&_td]:border-line-strong/70 [&_th]:border [&_th]:border-line-strong/70">
          <thead className="bg-table-head">
            <tr>
              <th scope="col" className="px-2 py-1 text-right">
                Time
              </th>
              <th scope="col" className="px-2 py-1 text-right">
                Supply
              </th>
              <th scope="col" className="px-2 py-1 text-left">
                Step
              </th>
              <th scope="col" className="px-2 py-1 text-left">
                Kind
              </th>
            </tr>
          </thead>
          <tbody>
            {player.steps.map((step, index) => (
              <tr key={index} className={step.cancelled ? "text-ink-muted" : undefined}>
                <td className="px-2 py-1 text-right tabular-nums">{formatFrame(step.frame)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{step.supply}</td>
                <td className={`px-2 py-1 ${step.kind === "building" ? "font-semibold" : ""}`}>
                  {stepLabel(step)}
                  {step.cancelled ? " (cancelled)" : null}
                </td>
                <td className="px-2 py-1 text-ink-muted">{KIND_LABELS[step.kind]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** One stored replay: the facts of the game and both build orders side by side. */
export function BuildReplayDetail({ replay }: { replay: BuildReplay }): ReactElement {
  const facts = [
    { label: "Map", value: replay.map },
    { label: "Played", value: formatDay(replay.playedAt) },
    { label: "Length", value: formatGameLength(replay.durationSeconds) },
  ];
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {facts.map((fact) => (
          <div key={fact.label} className="stat">
            <dt className="text-caption text-ink-muted">{fact.label}</dt>
            <dd className="text-heading tabular-nums">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <p className="flex flex-wrap gap-x-4 gap-y-1">
        <a href={replay.file} download className="font-medium">
          Download the replay
        </a>
        <a href={replay.sourceUrl} rel="noopener noreferrer" target="_blank">
          Watch it on cwal.gg
        </a>
      </p>
      <p className="text-caption text-ink-muted">
        Times are exact and read like the in game clock. Supply is a rough guide: a replay records
        clicks, not the supply count, so the site works it out, and it runs high once units start
        dying. A few steps may be wrong for the same reason. The first ten minutes are shown, with
        every building and research, the first of each army unit and every Overlord.
      </p>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {replay.players.map((player) => (
          <PlayerBuild
            key={player.name}
            player={player}
            won={(replay.result === "win") === player.subject}
          />
        ))}
      </div>
    </div>
  );
}
