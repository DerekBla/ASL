import Link from "next/link";
import type { ReactElement } from "react";

import { SITE_NAME } from "@/lib/config/site";

const NAV = [
  { href: "/seasons", label: "Seasons" },
  { href: "/players", label: "Players" },
  { href: "/elo", label: "ELO" },
  { href: "/head-to-head", label: "Head-to-head" },
  { href: "/races", label: "Races" },
] as const;

export function SiteHeader(): ReactElement {
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
      </div>
    </header>
  );
}
