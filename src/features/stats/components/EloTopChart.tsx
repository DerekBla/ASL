"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactElement } from "react";

import { formatElo, formatSeason } from "@/lib/utils/format";

type Point = { season: number; elo: number };

export type EloTopPlayer = { rank: number; player: string; history: readonly Point[] };

type Props = {
  /** The players to draw, best current rating first. */
  players: readonly EloTopPlayer[];
  /** Number of the latest season: the right edge of the chart. */
  lastSeason: number;
  start: number;
};

/** Drawn at the container's real width so text stays its true size on phones. */
const DEFAULT_W = 640;
const H = 340;
const PAD = { top: 18, right: 64, bottom: 28, left: 52 };

function niceTicks(min: number, max: number): number[] {
  const span = max - min;
  const step = span > 600 ? 200 : span > 250 ? 100 : 50;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max; t += step) ticks.push(t);
  return ticks;
}

/**
 * One color per line, by the player's place in the list. Ten slots, validated in this order
 * with the dataviz palette checks on the light and dark page backgrounds (globals.css).
 */
const SERIES = [
  { stroke: "stroke-series-1", fill: "fill-series-1", bg: "bg-series-1" },
  { stroke: "stroke-series-2", fill: "fill-series-2", bg: "bg-series-2" },
  { stroke: "stroke-series-3", fill: "fill-series-3", bg: "bg-series-3" },
  { stroke: "stroke-series-4", fill: "fill-series-4", bg: "bg-series-4" },
  { stroke: "stroke-series-5", fill: "fill-series-5", bg: "bg-series-5" },
  { stroke: "stroke-series-6", fill: "fill-series-6", bg: "bg-series-6" },
  { stroke: "stroke-series-7", fill: "fill-series-7", bg: "bg-series-7" },
  { stroke: "stroke-series-8", fill: "fill-series-8", bg: "bg-series-8" },
  { stroke: "stroke-series-9", fill: "fill-series-9", bg: "bg-series-9" },
  { stroke: "stroke-series-10", fill: "fill-series-10", bg: "bg-series-10" },
] as const;
const NEUTRAL = { stroke: "stroke-ink-muted", fill: "fill-ink-muted", bg: "bg-ink-muted" };

/** Rating a player held after a season: the last one they earned up to then, if any. */
function ratingAfter(history: readonly Point[], season: number): number | null {
  let value: number | null = null;
  for (const p of history) if (p.season <= season) value = p.elo;
  return value;
}

/**
 * The top rated players' ELO across every season, on one chart, each line in its own color
 * (Derek, 2026-10-08). The list below is the legend: picking a player thickens and labels
 * their line. Hover or use the arrow keys to read a season; the full numbers are in the table.
 */
export function EloTopChart({ players, lastSeason, start }: Props): ReactElement {
  const [picked, setPicked] = useState(players[0]?.player ?? "");
  const [season, setSeason] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(DEFAULT_W);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry?.contentRect.width ?? DEFAULT_W);
      if (width > 0) setW(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (players.length === 0) return <p className="text-ink-muted">No ELO history yet.</p>;

  const values = [start, ...players.flatMap((p) => p.history.map((h) => h.elo))];
  const lo = Math.floor((Math.min(...values) - 40) / 50) * 50;
  const hi = Math.ceil((Math.max(...values) + 40) / 50) * 50;
  const x = (s: number): number =>
    PAD.left + ((s - 1) / Math.max(1, lastSeason - 1)) * (W - PAD.left - PAD.right);
  const y = (elo: number): number =>
    PAD.top + ((hi - elo) / (hi - lo)) * (H - PAD.top - PAD.bottom);

  // A rating only changes in seasons played: hold flat across skipped seasons and out to the
  // latest season, so every line ends at the player's current rating.
  const pathOf = (history: readonly Point[]): string => {
    const parts = history.map((p, i) => {
      const prev = history[i - 1];
      if (!prev) return `M${x(p.season)},${y(p.elo)}`;
      const hold = p.season - prev.season > 1 ? `L${x(p.season - 1)},${y(prev.elo)} ` : "";
      return `${hold}L${x(p.season)},${y(p.elo)}`;
    });
    const last = history.at(-1);
    if (last && last.season < lastSeason) parts.push(`L${x(lastSeason)},${y(last.elo)}`);
    return parts.join(" ");
  };

  const chosen = players.find((p) => p.player === picked) ?? players[0];
  const colorOf = (player: string): (typeof SERIES)[number] | typeof NEUTRAL =>
    SERIES[players.findIndex((p) => p.player === player)] ?? NEUTRAL;
  const chosenColor = colorOf(chosen?.player ?? "");
  const chosenNow = chosen ? ratingAfter(chosen.history, lastSeason) : null;
  const chosenAt = chosen && season !== null ? ratingAfter(chosen.history, season) : null;

  function nearest(event: PointerEvent<SVGSVGElement>): void {
    const rect = event.currentTarget.getBoundingClientRect();
    const sx = ((event.clientX - rect.left) / rect.width) * W;
    const ratio = (sx - PAD.left) / (W - PAD.left - PAD.right);
    setSeason(Math.min(lastSeason, Math.max(1, Math.round(1 + ratio * (lastSeason - 1)))));
  }

  function step(event: KeyboardEvent<SVGSVGElement>): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    setSeason((s) => Math.min(lastSeason, Math.max(1, (s ?? lastSeason) + delta)));
  }

  const seasonTicks = Array.from({ length: lastSeason }, (_, i) => i + 1).filter(
    (s) =>
      s === 1 ||
      s === lastSeason ||
      ((W >= 480 ? s % 5 === 0 : s % 10 === 0) && x(lastSeason) - x(s) >= 32),
  );
  const seasons = Array.from({ length: lastSeason }, (_, i) => i + 1);

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="text-heading">Top {players.length} players over time</figcaption>
      <div className="relative" ref={box}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full overflow-visible"
          role="img"
          aria-label={`ELO after each season for the ${players.length} highest rated players: ${players.map((p) => p.player).join(", ")}. ${chosen?.player ?? ""} is highlighted. Use the left and right arrow keys to step through seasons.`}
          tabIndex={0}
          onPointerMove={nearest}
          onPointerLeave={() => setSeason(null)}
          onFocus={() => setSeason((s) => s ?? lastSeason)}
          onBlur={() => setSeason(null)}
          onKeyDown={step}
        >
          {niceTicks(lo, hi).map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                className="stroke-line"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 8}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                className="fill-ink-muted text-[11px]"
              >
                {t.toLocaleString("en-US")}
              </text>
            </g>
          ))}
          {seasonTicks.map((s) => (
            <text
              key={s}
              x={x(s)}
              y={H - 8}
              textAnchor="middle"
              className="fill-ink-muted text-[11px]"
            >
              {formatSeason(s)}
            </text>
          ))}

          {season !== null ? (
            <line
              x1={x(season)}
              x2={x(season)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              className="stroke-ink-muted"
              strokeWidth="1"
            />
          ) : null}

          {players
            .filter((p) => p.player !== chosen?.player)
            .map((p) => (
              <path
                key={p.player}
                d={pathOf(p.history)}
                fill="none"
                className={colorOf(p.player).stroke}
                strokeWidth="1.75"
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity="0.7"
              />
            ))}
          {chosen ? (
            <>
              <path
                d={pathOf(chosen.history)}
                fill="none"
                className={chosenColor.stroke}
                strokeWidth="3.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {chosen.history.map((p) => (
                <circle
                  key={p.season}
                  cx={x(p.season)}
                  cy={y(p.elo)}
                  r={p.season === season ? 5 : 3.5}
                  className={`${chosenColor.fill} stroke-surface`}
                  strokeWidth="2"
                />
              ))}
              {chosenNow !== null ? (
                <text
                  x={x(lastSeason) + 8}
                  y={y(chosenNow)}
                  dy="0.32em"
                  className="fill-ink text-[12px] font-semibold"
                >
                  {formatElo(chosenNow)}
                </text>
              ) : null}
            </>
          ) : null}
        </svg>

        {season !== null && chosen ? (
          <div
            role="status"
            className="pointer-events-none absolute top-0 rounded border border-line-strong bg-card px-2 py-1 text-caption shadow-sm"
            style={{ left: `${(x(season) / W) * 100}%`, transform: "translateX(-50%)" }}
          >
            <strong className="block text-data text-ink">{chosen.player}</strong>
            <span className="text-ink-muted tabular-nums">
              {chosenAt === null
                ? `not yet rated after ${formatSeason(season)}`
                : `${formatElo(chosenAt)} after ${formatSeason(season)}`}
            </span>
          </div>
        ) : null}
      </div>

      <div role="group" aria-label="Highlight a player" className="flex flex-wrap gap-1.5">
        {players.map((p) => {
          const on = p.player === chosen?.player;
          return (
            <button
              key={p.player}
              type="button"
              aria-pressed={on}
              onClick={() => setPicked(p.player)}
              className={`flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-data ${on ? "border-accent bg-surface-muted font-semibold" : "border-line-strong bg-card hover:bg-surface-muted"}`}
            >
              <span
                aria-hidden="true"
                className={`w-4 rounded ${colorOf(p.player).bg} ${on ? "h-1" : "h-0.5"}`}
              />
              <span className="text-ink-muted tabular-nums">{p.rank}.</span>
              {p.player}
            </button>
          );
        })}
      </div>
      <p className="text-caption text-ink-muted">
        The {players.length} highest rated players today, one color each. Pick a player to make
        their line stand out. A rating changes only in seasons a player entered and holds flat in
        between.
      </p>
      <details className="text-data">
        <summary className="cursor-pointer text-caption text-ink-muted">Show as a table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="border-collapse">
            <caption className="sr-only">ELO after each season, by player</caption>
            <thead>
              <tr>
                <th scope="col" className="px-2 py-1 text-left">
                  Season
                </th>
                {players.map((p) => (
                  <th key={p.player} scope="col" className="px-2 py-1 text-right">
                    {p.player}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {seasons.map((s) => (
                <tr key={s} className="border-t border-line">
                  <th scope="row" className="px-2 py-1 text-left font-normal">
                    {formatSeason(s)}
                  </th>
                  {players.map((p) => {
                    const value = ratingAfter(p.history, s);
                    return (
                      <td key={p.player} className="px-2 py-1 text-right tabular-nums">
                        {value === null ? "–" : formatElo(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
