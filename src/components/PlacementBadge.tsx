import type { ReactElement } from "react";

/** Structural copy of the exported PlacementValue (Shared UI may not import from services). */
type PlacementValue = {
  label: string;
  best: number;
  worst: number;
};

type Props = {
  placement: PlacementValue;
};

function tierClass(best: number): string {
  if (best === 1) return "bg-medal-gold text-race-ink font-semibold";
  if (best === 2) return "bg-medal-silver text-race-ink font-semibold";
  if (best <= 4) return "bg-medal-bronze text-race-ink";
  if (best <= 8) return "bg-surface-muted text-ink";
  return "text-ink-muted";
}

/** Renders a placement from its exported value. Never re-parses the label string. */
export function PlacementBadge({ placement }: Props): ReactElement {
  return (
    <span
      className={`inline-block rounded px-1.5 text-data leading-5 whitespace-nowrap tabular-nums ${tierClass(placement.best)}`}
    >
      {placement.label}
    </span>
  );
}
