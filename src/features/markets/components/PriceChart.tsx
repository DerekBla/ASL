"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactElement } from "react";

import { formatProbability } from "@/lib/utils/format";

type Props = {
  labels: readonly string[];
  /** Prices of every outcome after each trade, oldest first. */
  history: readonly { at: string; prices: readonly number[] }[];
};

// Series colors in fixed order (dataviz: never cycled; color follows the outcome, not its rank).
const STROKE = ["stroke-series-1", "stroke-series-2", "stroke-series-3", "stroke-series-4"];
const KEY = ["bg-series-1", "bg-series-2", "bg-series-3", "bg-series-4"];
const FILL = ["fill-series-1", "fill-series-2", "fill-series-3", "fill-series-4"];
const MAX_SERIES = STROKE.length;

const DEFAULT_W = 640;
const H = 200;
const PAD = { top: 12, right: 52, bottom: 12, left: 40 };
const GRID = [0, 0.25, 0.5, 0.75, 1];

/**
 * Price history: one solid line per outcome, plotted by trade. Legend with line keys, direct
 * end labels when they don't collide, crosshair tooltip on hover or arrow keys, table view.
 */
export function PriceChart({ labels, history }: Props): ReactElement {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(DEFAULT_W);
  const [active, setActive] = useState<number | null>(null);

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

  if (history.length < 2) {
    return <p className="text-caption text-ink-muted">The chart appears after the first trade.</p>;
  }

  const last = history.at(-1)?.prices ?? [];
  // With more outcomes than colors, chart the most likely ones; every price stays in the table.
  const shown = labels
    .map((label, idx) => ({ label, idx, now: last[idx] ?? 0 }))
    .sort((a, b) => b.now - a.now)
    .slice(0, MAX_SERIES)
    .sort((a, b) => a.idx - b.idx);
  const x = (i: number): number =>
    PAD.left + (i / (history.length - 1)) * (W - PAD.left - PAD.right);
  const y = (p: number): number => PAD.top + (1 - p) * (H - PAD.top - PAD.bottom);
  const point = active === null ? null : (history[active] ?? null);
  const ends = [...shown].sort((a, b) => b.now - a.now);
  const labelEnds = ends.every(
    (s, i) => i === 0 || Math.abs((ends[i - 1]?.now ?? 0) - s.now) >= 0.08,
  );

  function nearest(event: PointerEvent<SVGSVGElement>): void {
    const rect = event.currentTarget.getBoundingClientRect();
    const sx = ((event.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((sx - PAD.left) / (W - PAD.left - PAD.right)) * (history.length - 1));
    setActive(Math.min(history.length - 1, Math.max(0, i)));
  }

  function step(event: KeyboardEvent<SVGSVGElement>): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    setActive((i) => Math.min(history.length - 1, Math.max(0, (i ?? history.length - 1) + delta)));
  }

  return (
    <figure className="flex flex-col gap-3">
      <ul
        className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-muted"
        aria-label="Legend"
      >
        {shown.map((s) => (
          <li key={s.idx} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`h-0.5 w-4 rounded-full ${KEY[shown.indexOf(s)] ?? KEY[0]}`}
            />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="relative" ref={box}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full overflow-visible"
          role="img"
          aria-label={`Price history over ${history.length - 1} trades. Now: ${labels
            .map((l, i) => `${l} ${formatProbability(last[i] ?? 0)}`)
            .join(", ")}. Use the left and right arrow keys to step through trades.`}
          tabIndex={0}
          onPointerMove={nearest}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((i) => i ?? history.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={step}
        >
          {GRID.map((g) => (
            <g key={g}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(g)}
                y2={y(g)}
                className="stroke-line"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 8}
                y={y(g)}
                dy="0.32em"
                textAnchor="end"
                className="fill-ink-muted text-[11px]"
              >
                {Math.round(g * 100)}%
              </text>
            </g>
          ))}
          {point && active !== null ? (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              className="stroke-ink-muted"
              strokeWidth="1"
            />
          ) : null}
          {shown.map((s, slot) => (
            <polyline
              key={s.idx}
              fill="none"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              className={STROKE[slot] ?? STROKE[0]}
              points={history.map((h, i) => `${x(i)},${y(h.prices[s.idx] ?? 0)}`).join(" ")}
            />
          ))}
          {shown.map((s, slot) => (
            <circle
              key={s.idx}
              cx={x(active ?? history.length - 1)}
              cy={y((point ?? history.at(-1))?.prices[s.idx] ?? 0)}
              r="4"
              strokeWidth="2"
              className={`stroke-card ${FILL[slot] ?? "fill-series-1"}`}
            />
          ))}
          {labelEnds
            ? shown.map((s) => (
                <text
                  key={s.idx}
                  x={x(history.length - 1) + 10}
                  y={y(s.now)}
                  dy="0.32em"
                  className="fill-ink text-[12px] font-medium"
                >
                  {formatProbability(s.now)}
                </text>
              ))
            : null}
        </svg>
        {point && active !== null ? (
          <div
            role="status"
            className="pointer-events-none absolute top-0 rounded border border-line-strong bg-card px-2 py-1 text-caption shadow-sm"
            style={{ left: `${(x(active) / W) * 100}%`, transform: "translateX(-50%)" }}
          >
            {shown.map((s, slot) => (
              <span key={s.idx} className="flex items-center gap-1.5 whitespace-nowrap">
                <span
                  aria-hidden="true"
                  className={`h-0.5 w-3 rounded-full ${KEY[slot] ?? KEY[0]}`}
                />
                <strong className="text-ink tabular-nums">
                  {formatProbability(point.prices[s.idx] ?? 0)}
                </strong>
                <span className="text-ink-muted">{s.label}</span>
              </span>
            ))}
            <span className="text-ink-muted">
              {active === 0 ? "Opening price" : `After trade ${active}`}
            </span>
          </div>
        ) : null}
      </div>
      <details className="text-data">
        <summary className="cursor-pointer text-caption text-ink-muted">Show as a table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="border-collapse">
            <thead>
              <tr>
                <th scope="col" className="px-2 py-1 text-left">
                  Trade
                </th>
                {labels.map((l) => (
                  <th key={l} scope="col" className="px-2 py-1 text-right">
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} className="border-t border-line/60">
                  <td className="px-2 py-1">{i === 0 ? "Opening" : i}</td>
                  {labels.map((l, idx) => (
                    <td key={l} className="px-2 py-1 text-right tabular-nums">
                      {formatProbability(h.prices[idx] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
