import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

import { SITE_NAME } from "@/lib/config/site";

import { Logo } from "./Logo";

/**
 * One row of links under the name and the search box, stats first and then the games (Derek, 2026-10-08: no group labels). Each
 * label matches the heading of the page it opens.
 */
const NAV_ITEMS = [
  { href: "/seasons", label: "Seasons" },
  { href: "/players", label: "Players" },
  { href: "/elo", label: "ELO ratings" },
  { href: "/head-to-head", label: "Head to head" },
  { href: "/races", label: "Race stats" },
  { href: "/maps", label: "Maps" },
  { href: "/records", label: "Records" },
  { href: "/builds", label: "Build orders" },
  { href: "/markets", label: "Markets" },
  { href: "/leaderboard", label: "Market leaderboard" },
  { href: "/pickem", label: "Pick'em" },
  { href: "/drafts", label: "Drafts" },
] as const;

type Props = {
  /** Sign-in control, supplied by the layout when sign-in is switched on. */
  account?: ReactNode;
  /** The player search box, supplied by the layout. */
  search?: ReactNode;
};

export function SiteHeader({ account, search }: Props): ReactElement {
  return (
    <header className="sticky top-0 z-20 bg-nav text-on-nav">
      <div className="mx-auto flex min-h-[3.125rem] w-full max-w-5xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-1">
        <Link
          href="/"
          className="flex items-center gap-2 text-[1.125rem] font-semibold text-on-nav no-underline hover:no-underline"
        >
          <Logo />
          {SITE_NAME}
        </Link>
        {search || account ? (
          <div className="ml-auto flex items-center gap-3">
            {search}
            {account}
          </div>
        ) : null}
        <nav aria-label="Main" className="w-full">
          <ul className="flex flex-wrap gap-1">
            {NAV_ITEMS.map((item) => (
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
        </nav>
      </div>
    </header>
  );
}
