import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

import { SITE_NAME } from "@/lib/config/site";

/**
 * Two labeled groups, stats first: the site is a stats site that also has games to play
 * (Derek, 2026-10-08). Each label matches the heading of the page it opens.
 */
const NAV_GROUPS = [
  {
    label: "Stats",
    items: [
      { href: "/seasons", label: "Seasons" },
      { href: "/players", label: "Players" },
      { href: "/elo", label: "ELO ratings" },
      { href: "/head-to-head", label: "Head to head" },
      { href: "/races", label: "Race stats" },
    ],
  },
  {
    label: "Play",
    items: [
      { href: "/markets", label: "Markets" },
      { href: "/leaderboard", label: "Market leaderboard" },
      { href: "/pickem", label: "Pick'em" },
      { href: "/drafts", label: "Drafts" },
    ],
  },
] as const;

type Props = {
  /** Sign-in control, supplied by the layout when sign-in is switched on. */
  account?: ReactNode;
};

export function SiteHeader({ account }: Props): ReactElement {
  return (
    <header className="sticky top-0 z-20 bg-nav text-on-nav">
      <div className="mx-auto flex min-h-[3.125rem] w-full max-w-5xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-1">
        <Link
          href="/"
          className="text-[1.125rem] font-semibold text-on-nav no-underline hover:no-underline"
        >
          {SITE_NAME}
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {NAV_GROUPS.map((group) => {
            const labelId = `nav-${group.label.toLowerCase()}`;
            return (
              <div key={group.label} className="flex flex-wrap items-center gap-1">
                <span
                  id={labelId}
                  className="text-caption font-semibold tracking-wide text-on-nav/70 uppercase"
                >
                  {group.label}
                </span>
                <ul aria-labelledby={labelId} className="flex flex-wrap gap-1">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="rounded px-2 py-1.5 text-data font-semibold text-on-nav/90 no-underline transition-colors hover:bg-nav-hover hover:text-on-nav-hover hover:no-underline"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
        {account ? <div className="ml-auto">{account}</div> : null}
      </div>
    </header>
  );
}
