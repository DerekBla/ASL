import type { ReactElement } from "react";

import type { Achievement } from "@/lib/pickem/achievements";

type Props = {
  achievements: readonly Achievement[];
  /** "full" adds each description; "compact" is names only, for a table cell. */
  display?: "full" | "compact";
};

export function AchievementList({ achievements, display = "full" }: Props): ReactElement | null {
  if (achievements.length === 0) return null;
  if (display === "compact") {
    return (
      <ul className="flex flex-wrap gap-1">
        {achievements.map((a) => (
          <li
            key={a.key}
            title={a.description}
            className="rounded border border-line-strong bg-medal-gold px-1.5 text-caption font-semibold text-race-ink"
          >
            {a.name}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {achievements.map((a) => (
        <li key={a.key} className="flex flex-col stat">
          <strong>{a.name}</strong>
          <span className="text-caption text-ink-muted">{a.description}</span>
        </li>
      ))}
    </ul>
  );
}
