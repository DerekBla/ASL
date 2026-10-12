import Link from "next/link";
import type { ReactElement } from "react";

import type { BuildPlayer, BuildReplay } from "@/lib/services/builds";
import { findPlayer, playerSlug } from "@/lib/services/stats";
import { formatDay, formatGameLength } from "@/lib/utils/format";

import { RaceBadge } from "@/components/RaceBadge";

import { BUILD_ORDER_NOTE, BuildOrderTable } from "./BuildOrderTable";

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
      <BuildOrderTable steps={player.steps} />
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
      <p className="text-caption text-ink-muted">{BUILD_ORDER_NOTE}</p>
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
