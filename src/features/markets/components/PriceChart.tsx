import type { ReactElement } from "react";

import { formatProbability } from "@/lib/utils/format";

type Props = {
  labels: readonly string[];
  /** Prices of every outcome after each trade, oldest first. */
  history: readonly { at: string; prices: readonly number[] }[];
};

// Line colors cycle through accent, ink and muted ink. Each line is also labelled in text below,
// so color is never the only cue (comp-6).
const STROKES = ["stroke-accent", "stroke-ink", "stroke-ink-muted"];
const DASH = ["", "6 4", "2 3"];

/** Price history: one line per outcome, plotted by trade (not by clock time). */
export function PriceChart({ labels, history }: Props): ReactElement {
  if (history.length < 2) {
    return <p className="text-caption text-ink-muted">The chart appears after the first trade.</p>;
  }
  const width = 600;
  const height = 160;
  const x = (i: number): number => (i / (history.length - 1)) * width;
  const y = (p: number): number => height - p * height;
  const last = history.at(-1)?.prices ?? [];

  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-40 w-full rounded-md border border-line bg-surface"
        role="img"
        aria-label={`Price history over ${history.length - 1} trades. Now: ${labels
          .map((l, i) => `${l} ${formatProbability(last[i] ?? 0)}`)
          .join(", ")}.`}
        preserveAspectRatio="none"
      >
        <line
          x1="0"
          x2={width}
          y1={height / 2}
          y2={height / 2}
          className="stroke-line"
          strokeDasharray="4 4"
        />
        {labels.map((label, outcome) => (
          <polyline
            key={label}
            fill="none"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
            className={STROKES[outcome % STROKES.length]}
            strokeDasharray={DASH[outcome % DASH.length]}
            points={history.map((h, i) => `${x(i)},${y(h.prices[outcome] ?? 0)}`).join(" ")}
          />
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-4 text-caption text-ink-muted">
        {labels.map((label, i) => (
          <span key={label}>
            {i === 0 ? "Solid" : i === 1 ? "Dashed" : "Dotted"} line: {label}
          </span>
        ))}
        <span>Middle line: 50%</span>
      </figcaption>
    </figure>
  );
}
