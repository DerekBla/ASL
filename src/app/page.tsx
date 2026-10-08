import Link from "next/link";
import type { ReactElement } from "react";

import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/config/site";
import { getLatestCompleteSeason, getManifest } from "@/lib/services/stats";

const numberFormat = new Intl.NumberFormat("en-US");

const SECTIONS = [
  {
    href: "/seasons",
    title: "Seasons",
    blurb: "Every season's final, placements, groups and prize money.",
  },
  { href: "/players", title: "Players", blurb: "Career stats for every player, season by season." },
  {
    href: "/elo",
    title: "ELO ratings",
    blurb: "ELO from season placements, current and peak, like the old spreadsheet.",
  },
  {
    href: "/head-to-head",
    title: "Head to head",
    blurb: "Every ASL series between any two players.",
  },
  { href: "/races", title: "Race stats", blurb: "Titles and series matchups by race." },
] as const;

export default function HomePage(): ReactElement {
  const { counts } = getManifest();
  const latest = getLatestCompleteSeason();
  const facts = [
    { label: "Seasons", value: counts.seasons },
    { label: "Players", value: counts.players },
    { label: "Series played", value: counts.series },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1>{SITE_NAME}</h1>
        <p className="text-ink-muted">{SITE_DESCRIPTION}</p>
      </header>

      <section aria-labelledby="coverage-heading" className="flex flex-col gap-3">
        <h2 id="coverage-heading">What the data covers</h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.label} className="stat">
              <dt className="text-caption text-ink-muted">{fact.label}</dt>
              <dd className="text-title tabular-nums">
                {fact.value === undefined ? "–" : numberFormat.format(fact.value)}
              </dd>
            </div>
          ))}
        </dl>
        {latest?.winner ? (
          <p>
            Latest champion: <strong>{latest.winner}</strong>, who beat {latest.runnerUp}{" "}
            {latest.finalScore?.replace("-", "–")} in {latest.name}.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="explore-heading" className="flex flex-col gap-3">
        <h2 id="explore-heading">Explore</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="card block h-full p-5 no-underline transition-shadow hover:no-underline hover:shadow-md"
              >
                <span className="text-heading text-ink">{s.title}</span>
                <span className="mt-1 block text-ink-muted">{s.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-ink-muted">
        Markets are open: <Link href="/markets">trade play money minerals</Link> on ASL matches.
      </p>
    </div>
  );
}
