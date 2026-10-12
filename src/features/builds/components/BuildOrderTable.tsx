import type { ReactElement } from "react";

import { formatFrame } from "@/lib/replay/buildOrder";
import type { BuildStep } from "@/lib/replay/buildOrder";

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

/** Said wherever a build order is shown: what is exact and what is an estimate. */
export const BUILD_ORDER_NOTE =
  "Times are exact and read like the in game clock. Supply is a rough guide: a replay records clicks, not the supply count, so the site works it out, and it runs high once units start dying. A few steps may be wrong for the same reason. The first ten minutes are shown, with every building and research, the first of each army unit and every Overlord.";

/** One player's build order: time, supply, step. Used for stored and uploaded replays. */
export function BuildOrderTable({ steps }: { steps: readonly BuildStep[] }): ReactElement {
  if (steps.length === 0) {
    return <p className="text-ink-muted">No build order could be read for this player.</p>;
  }
  return (
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
          {steps.map((step, index) => (
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
  );
}
