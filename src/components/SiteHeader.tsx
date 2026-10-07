import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

import { SITE_NAME } from "@/lib/config/site";

const NAV = [
  { href: "/markets", label: "Markets" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/seasons", label: "Seasons" },
  { href: "/players", label: "Players" },
  { href: "/elo", label: "ELO" },
  { href: "/head-to-head", label: "Head-to-head" },
  { href: "/races", label: "Races" },
] as const;

type Props = {
  /** Sign-in control, supplied by the layout when sign-in is switched on. */
  account?: ReactNode;
};

export function SiteHeader({ account }: Props): ReactElement {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="font-bold text-ink no-underline">
          {SITE_NAME}
        </Link>
        <nav aria-label="Main">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-ink no-underline hover:text-accent">
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
