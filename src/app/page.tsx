import Link from "next/link";
import type { ReactElement } from "react";

import {
  AUTHOR_NAME,
  AUTHOR_URL,
  SIGNUP_GRANT_CREDITS,
  SITE_DESCRIPTION,
  SITE_NAME,
} from "@/lib/config/site";
import { getLatestCompleteSeason, getManifest } from "@/lib/services/stats";

const numberFormat = new Intl.NumberFormat("en-US");

type Card = { href: string; title: string; blurb: string };

const STATS: readonly Card[] = [
  {
    href: "/seasons",
    title: "Seasons",
    blurb: "Every season's final, placements, groups and prize money.",
  },
  { href: "/players", title: "Players", blurb: "Career stats for every player, season by season." },
  {
    href: "/elo",
    title: "ELO ratings",
    blurb: "A rating for every player, built from where they finished each season.",
  },
  {
    href: "/head-to-head",
    title: "Head to head",
    blurb: "Pick any two players and see every ASL series between them.",
  },
  {
    href: "/races",
    title: "Race stats",
    blurb: "How Terran, Zerg and Protoss have done: titles and series against each other.",
  },
];

const GAMES: readonly Card[] = [
  {
    href: "/markets",
    title: "Markets",
    blurb:
      "Predict match results with minerals, the site's play money. The price of each outcome is the crowd's odds.",
  },
  {
    href: "/pickem",
    title: "Pick'em",
    blurb:
      "Fill out a bracket before a season starts: who gets out of every round, down to the champion.",
  },
  {
    href: "/drafts",
    title: "Drafts",
    blurb:
      "Fantasy ASL. Draft the season's players with friends and score a point for every game they win.",
  },
];

function Cards({ cards }: { cards: readonly Card[] }): ReactElement {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {cards.map((card) => (
        <li key={card.href}>
          <Link
            href={card.href}
            className="card block h-full p-5 no-underline transition-shadow hover:border-accent hover:no-underline"
          >
            <span className="text-heading text-ink">{card.title}</span>
            <span className="mt-1 block text-ink-muted">{card.blurb}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

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
        <p>{SITE_DESCRIPTION}</p>
        <p className="text-ink-muted">
          The ASL is the top StarCraft: Brood War league. Look up any season, player or matchup
          here. If you want to play along with a season, there are three free games as well:
          prediction markets, a bracket pick&apos;em and fantasy drafts. None of them use real
          money.
        </p>
        <p className="text-caption text-ink-muted">
          Made by{" "}
          <a href={AUTHOR_URL} rel="author">
            {AUTHOR_NAME}
          </a>
          .
        </p>
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

      <section aria-labelledby="stats-heading" className="flex flex-col gap-3">
        <h2 id="stats-heading">Browse the stats</h2>
        <Cards cards={STATS} />
      </section>

      <section aria-labelledby="games-heading" className="flex flex-col gap-3">
        <h2 id="games-heading">Play along</h2>
        <p className="text-ink-muted">
          Free, and for fun. You need an account to play; everyone can look. Markets use minerals,
          which are play money: you get {SIGNUP_GRANT_CREDITS} when you sign up, and they cannot be
          bought, sold or exchanged.
        </p>
        <Cards cards={GAMES} />
      </section>
    </div>
  );
}
