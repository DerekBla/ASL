"use client";

import { useId, useRef, useState } from "react";
import type { DragEvent, ReactElement } from "react";

import { FRAME_MS, formatFrame } from "@/lib/replay/buildOrder";
import { ReplayReadError } from "@/lib/replay/readReplay";
import type { ReplayBuilds, ReplayPlayer } from "@/lib/replay/readReplay";

import { RaceBadge } from "@/components/RaceBadge";

import { parseReplayFile } from "../parseReplayFile";
import { BUILD_ORDER_NOTE, BuildOrderTable, stepLabel } from "./BuildOrderTable";

type State =
  | { status: "idle" }
  | { status: "reading"; fileName: string }
  | { status: "error"; fileName: string; message: string }
  | { status: "done"; fileName: string; replay: ReplayBuilds };

/** The build order as plain lines, for pasting into notes: "0:53  9  Supply Depot". */
export function buildOrderText(player: ReplayPlayer): string {
  return player.steps
    .map(
      (step) =>
        `${formatFrame(step.frame).padStart(5)}  ${String(step.supply).padStart(3)}  ${stepLabel(step)}${step.cancelled ? " (cancelled)" : ""}`,
    )
    .join("\n");
}

function PlayerResult({ player }: { player: ReplayPlayer }): ReactElement {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(buildOrderText(player));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section aria-label={`Build order of ${player.name}`} className="flex flex-col gap-2">
      <h2 className="flex flex-wrap items-center gap-2">
        <RaceBadge race={player.race} />
        {player.name}
        {player.won === null ? null : (
          <span className="text-caption font-normal text-ink-muted">
            {player.won ? "Won" : "Lost"}
          </span>
        )}
      </h2>
      <p className="flex flex-wrap items-center gap-x-3 text-caption text-ink-muted">
        <span>
          {player.start > 0 ? <>Started at {player.start} o&apos;clock. </> : null}
          {player.apm} actions a minute.
        </span>
        {player.steps.length > 0 ? (
          <button type="button" onClick={() => void copy()} className="underline">
            {copied ? "Copied" : "Copy as text"}
          </button>
        ) : null}
      </p>
      <BuildOrderTable steps={player.steps} />
    </section>
  );
}

/**
 * Pick or drop a replay and see every player's build order. The file is read on the page and
 * is never sent anywhere.
 */
export function ReplayUpload(): ReactElement {
  const [state, setState] = useState<State>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputId = useId();
  const latest = useRef(0);

  async function read(file: File): Promise<void> {
    const turn = ++latest.current;
    setState({ status: "reading", fileName: file.name });
    try {
      const replay = await parseReplayFile(file);
      if (turn === latest.current) setState({ status: "done", fileName: file.name, replay });
    } catch (error) {
      if (turn !== latest.current) return;
      const message =
        error instanceof ReplayReadError
          ? error.message
          : "Something went wrong reading this replay.";
      setState({ status: "error", fileName: file.name, message });
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void read(file);
  }

  return (
    <div className="flex flex-col gap-6">
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`card flex cursor-pointer flex-col items-center gap-1 border-2 border-dashed px-4 py-8 text-center ${dragging ? "border-accent bg-surface-muted" : ""}`}
      >
        <span className="font-semibold">Choose a replay, or drop one here</span>
        <span className="text-caption text-ink-muted">
          A .rep file from StarCraft: Remastered or from 1.16. It is read in your browser and is not
          sent to the site.
        </span>
        <input
          id={inputId}
          type="file"
          accept=".rep"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void read(file);
            event.target.value = "";
          }}
        />
      </label>

      <div aria-live="polite" className="flex flex-col gap-6">
        {state.status === "reading" ? <p>Reading {state.fileName}…</p> : null}
        {state.status === "error" ? (
          <p role="alert" className="card px-3 py-2">
            <strong>{state.fileName}</strong>: {state.message}
          </p>
        ) : null}
        {state.status === "done" ? (
          <Result fileName={state.fileName} replay={state.replay} />
        ) : null}
      </div>
    </div>
  );
}

function Result({ fileName, replay }: { fileName: string; replay: ReplayBuilds }): ReactElement {
  const seconds = Math.floor((replay.frames * FRAME_MS) / 1000);
  const facts = [
    { label: "Map", value: replay.map },
    { label: "Length", value: formatFrame(replay.frames) },
    { label: "File", value: fileName },
  ];
  return (
    <>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {facts.map((fact) => (
          <div key={fact.label} className="stat">
            <dt className="text-caption text-ink-muted">{fact.label}</dt>
            <dd className="text-heading break-words tabular-nums">{fact.value}</dd>
          </div>
        ))}
      </dl>
      {replay.speed !== "Fastest" ? (
        <p role="alert" className="card px-3 py-2">
          This game was played on {replay.speed}, not Fastest, so the times shown here do not match
          the clock.
        </p>
      ) : null}
      {seconds < 120 ? (
        <p className="text-ink-muted">
          This game ended almost at once, so there is little to show.
        </p>
      ) : null}
      <p className="text-caption text-ink-muted">{BUILD_ORDER_NOTE}</p>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {replay.players.map((player) => (
          <PlayerResult key={player.id} player={player} />
        ))}
      </div>
    </>
  );
}
