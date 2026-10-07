"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactElement } from "react";

import { formatElo, formatSeason } from "@/lib/utils/format";

type Point = { season: number; elo: number };

type Props = {
  player: string;
  history: readonly Point[];
  /** Number of the latest season, so the x-axis covers every season even if they skipped some. */
  lastSeason: number;
  start: number;
};

/** Drawn at the container's real width so text stays its true size on phones. */
const DEFAULT_W = 640;
const H = 220;
const PAD = { top: 18, right: 56, bottom: 28, left: 52 };

function niceTicks(min: number, max: number): number[] {
  const span = max - min;
  const step = span > 600 ? 200 : span > 250 ? 100 : 50;
  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let t = first; t <= max; t += step) ticks.push(t);
  return ticks;
}

/**
 * ELO after each season a player entered. Single series: no legend, the title names it
 * (dataviz). Crosshair + tooltip on hover, the same readout on keyboard focus, and a table.
 */
export function EloChart({ player, history, lastSeason, start }: Props): ReactElement {
  const [active, setActive] = useState<number | null>(null);
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

  if (history.length === 0) return <p className="text-ink-muted">No ELO history yet.</p>;

  const values = [start, ...history.map((p) => p.elo)];
  const lo = Math.floor((Math.min(...values) - 40) / 50) * 50;
  const hi = Math.ceil((Math.max(...values) + 40) / 50) * 50;
  const x = (season: number): number =>
    PAD.left + ((season - 1) / Math.max(1, lastSeason - 1)) * (W - PAD.left - PAD.right);
  const y = (elo: number): number =>
    PAD.top + ((hi - elo) / (hi - lo)) * (H - PAD.top - PAD.bottom);

  const peak = history.reduce((best, p) => (p.elo > best.elo ? p : best));
  const last = history.at(-1) ?? peak;
  const current = active === null ? null : (history[active] ?? null);

  function nearest(event: PointerEvent<SVGSVGElement>): void {
    const box = event.currentTarget.getBoundingClientRect();
    const sx = ((event.clientX - box.left) / box.width) * W;
    let best = 0;
    history.forEach((p, i) => {
      if (Math.abs(x(p.season) - sx) < Math.abs(x(history[best]?.season ?? 1) - sx)) best = i;
    });
    setActive(best);
  }

  function step(event: KeyboardEvent<SVGSVGElement>): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    setActive((i) => Math.min(history.length - 1, Math.max(0, (i ?? history.length - 1) + delta)));
  }

  // The rating only changes in seasons played: across skipped seasons the line holds flat, then
  // moves during the next season entered (a diagonal would suggest a gradual change).
  const path = history
    .map((p, i) => {
      const prev = history[i - 1];
      if (!prev) return `M${x(p.season)},${y(p.elo)}`;
      const hold = p.season - prev.season > 1 ? `L${x(p.season - 1)},${y(prev.elo)} ` : "";
      return `${hold}L${x(p.season)},${y(p.elo)}`;
    })
    .join(" ");
  // Every 5th season (10th when narrow), plus first and last; drop a tick that would crowd the last.
  const seasonTicks = Array.from({ length: lastSeason }, (_, i) => i + 1).filter(
    (s) =>
      s === 1 ||
      s === lastSeason ||
      ((W >= 480 ? s % 5 === 0 : s % 10 === 0) && x(lastSeason) - x(s) >= 32),
  );

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-heading">ELO over time</figcaption>
      <div className="relative" ref={box}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full overflow-visible"
          role="img"
          aria-label={`${player}'s ELO after each of ${history.length} seasons, from ${formatElo(history[0]?.elo ?? start)} in ${formatSeason(history[0]?.season ?? 1)} to ${formatElo(last.elo)} in ${formatSeason(last.season)}. Peak ${formatElo(peak.elo)} in ${formatSeason(peak.season)}. Use the left and right arrow keys to step through seasons.`}
          tabIndex={0}
          onPointerMove={nearest}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((i) => i ?? history.length - 1)}
          onBlur={() => setActive(null)}
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
          {/* Starting rating. Named in the caption, not on the plot, where it would collide
              with the end label whenever a player finishes near the start. */}
          {start >= lo && start <= hi ? (
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(start)}
              y2={y(start)}
              className="stroke-ink-muted"
              strokeWidth="1"
              opacity="0.5"
            />
          ) : null}

          {current ? (
            <line
              x1={x(current.season)}
              x2={x(current.season)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              className="stroke-ink-muted"
              strokeWidth="1"
            />
          ) : null}

          <path
            d={path}
            fill="none"
            className="stroke-chart-line"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {history.map((p, i) => (
            <circle
              key={p.season}
              cx={x(p.season)}
              cy={y(p.elo)}
              r={i === active ? 5.5 : 4}
              className="fill-chart-line stroke-surface"
              strokeWidth="2"
            />
          ))}

          <text
            x={x(last.season) + 10}
            y={y(last.elo)}
            dy="0.32em"
            className="fill-ink text-[12px] font-semibold"
          >
            {formatElo(last.elo)}
          </text>
          {peak.season !== last.season ? (
            <text
              x={x(peak.season)}
              y={y(peak.elo) - 12}
              textAnchor="middle"
              className="fill-ink-muted text-[11px]"
            >
              Peak {formatElo(peak.elo)}
            </text>
          ) : null}
        </svg>

        {current ? (
          <div
            role="status"
            className="pointer-events-none absolute top-0 rounded-md border border-line bg-surface px-2 py-1 text-caption shadow-sm"
            style={{ left: `${(x(current.season) / W) * 100}%`, transform: "translateX(-50%)" }}
          >
            <strong className="block text-data text-ink tabular-nums">
              {formatElo(current.elo)}
            </strong>
            <span className="text-ink-muted">after {formatSeason(current.season)}</span>
          </div>
        ) : null}
      </div>
      <p className="text-caption text-ink-muted">
        One point per season entered; the rating holds flat through seasons a player skipped. The
        thin gray line is the starting rating, {start.toLocaleString("en-US")}.
      </p>
      <details className="text-data">
        <summary className="cursor-pointer text-caption text-ink-muted">Show as a table</summary>
        <table className="mt-2 border-collapse">
          <thead>
            <tr>
              <th scope="col" className="px-2 py-1 text-left">
                Season
              </th>
              <th scope="col" className="px-2 py-1 text-right">
                ELO after
              </th>
            </tr>
          </thead>
          <tbody>
            {history.map((p) => (
              <tr key={p.season} className="border-t border-line">
                <td className="px-2 py-1">{formatSeason(p.season)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{formatElo(p.elo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
