import type { ReactElement } from "react";

import { RACE_NAMES } from "@/lib/types/race";
import type { Race } from "@/lib/types/race";

const PALE: Record<Race, string> = {
  T: "bg-race-terran-pale",
  Z: "bg-race-zerg-pale",
  P: "bg-race-protoss-pale",
};

const DARK: Record<Race, string> = {
  T: "bg-race-terran-dark",
  Z: "bg-race-zerg-dark",
  P: "bg-race-protoss-dark",
};

type Props = {
  race: Race | null;
  /** "letter" shows T/Z/P (the full name is still read out); "name" shows Terran/Zerg/Protoss. */
  display?: "letter" | "name";
  /** Dark is for section headers only; data cells use pale (the default). */
  tone?: "pale" | "dark";
};

/** The only way a race is shown on the site. Always text plus color, never color alone. */
export function RaceBadge({ race, display = "letter", tone = "pale" }: Props): ReactElement {
  const base = "inline-flex items-center justify-center rounded-full px-2 font-medium leading-5";
  if (race === null) {
    return (
      <span className={`${base} bg-surface-muted text-ink-muted`} title="Race unknown">
        ?
      </span>
    );
  }
  const name = RACE_NAMES[race];
  const color = tone === "dark" ? `${DARK[race]} text-race-on-dark` : `${PALE[race]} text-race-ink`;
  const width = display === "letter" ? "min-w-6" : "";
  return (
    <span className={`${base} ${width} ${color} text-data`} title={name}>
      {display === "letter" ? (
        <>
          <span aria-hidden="true">{race}</span>
          <span className="sr-only">{name}</span>
        </>
      ) : (
        name
      )}
    </span>
  );
}
