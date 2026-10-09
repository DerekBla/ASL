import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

import { SITE_NAME } from "@/lib/config/site";

import { Logo } from "./Logo";

/**
 * One row of links, stats first and then the games (Derek, 2026-10-08: no group labels). Each
 * label matches the heading of the page it opens.
 */
const NAV_ITEMS = [
  { href: "/seasons", label: "Seasons" },
  { href: "/players", label: "Players" },
  { href: "/elo", label: "ELO ratings" },
  { href: "/head-to-head", label: "Head to head" },
  { href: "/races", label: "Race stats" },
  { href: "/markets", label: "Markets" },
  { href: "/leaderboard", label: "Market leaderboard" },
  { href: "/pickem", label: "Pick'em" },
  { href: "/drafts", label: "Drafts" },
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
          className="flex items-center gap-2 text-[1.125rem] font-semibold text-on-nav no-underline hover:no-underline"
        >
          <Logo />
          {SITE_NAME}
        </Link>
        <nav aria-label="Main">
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
        {account ? <div className="ml-auto">{account}</div> : null}
      </div>
    </header>
  );
}
