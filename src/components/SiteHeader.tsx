import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

import { SITE_NAME } from "@/lib/config/site";

const NAV = [
  { href: "/markets", label: "Markets" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/seasons", label: "Seasons" },
  { href: "/players", label: "Players" },
  { href: "/elo", label: "ELO" },
  { href: "/head-to-head", label: "Head to head" },
  { href: "/races", label: "Races" },
] as const;

type Props = {
  /** Sign-in control, supplied by the layout when sign-in is switched on. */
  account?: ReactNode;
};

export function SiteHeader({ account }: Props): ReactElement {
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-heading text-ink no-underline hover:no-underline">
          {SITE_NAME}
        </Link>
        <nav aria-label="Main">
          <ul className="flex flex-wrap gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-full px-3 py-1.5 text-data text-ink-muted no-underline transition-colors hover:bg-surface-muted hover:text-ink hover:no-underline"
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
