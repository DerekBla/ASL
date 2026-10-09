import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";

import { playerSlug, searchPlayers } from "@/lib/services/stats";

import { PlayerLink } from "@/features/stats";

import { RaceBadge } from "@/components/RaceBadge";

export const metadata: Metadata = {
  title: "Find a player",
  robots: { index: false },
};

type Props = {
  searchParams: Promise<{ q?: string | string[] }>;
};

/** Where the header search box lands: straight to the player on one match, else a list. */
export default async function SearchPage({ searchParams }: Props): Promise<ReactElement> {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const found = searchPlayers(q);
  const only = found.length === 1 ? found[0] : undefined;
  if (only) redirect(`/players/${playerSlug(only.player)}`);

  return (
    <div className="flex flex-col gap-4">
      <h1>Find a player</h1>
      {q === "" ? (
        <p>Type a player&apos;s name in the box at the top of the page.</p>
      ) : found.length === 0 ? (
        <p>
          No ASL player matches &quot;{q}&quot;. Old spellings work too. You can also browse{" "}
          <Link href="/players">all players</Link>.
        </p>
      ) : (
        <>
          <p className="text-ink-muted">
            {found.length} players match &quot;{q}&quot;.
          </p>
          <ul className="flex flex-col gap-1.5">
            {found.map((p) => (
              <li key={p.player} className="flex flex-wrap items-center gap-2">
                <RaceBadge race={p.race} />
                <PlayerLink name={p.player} />
                {p.aliases.length > 0 ? (
                  <span className="text-caption text-ink-muted">
                    also written as {p.aliases.join(", ")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
