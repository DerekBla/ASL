import type { ReactElement } from "react";

import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/config/site";
import { getLatestCompleteSeason, getManifest } from "@/lib/services/stats";

const numberFormat = new Intl.NumberFormat("en-US");

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
            <div key={fact.label} className="rounded-lg border border-line bg-surface-muted p-4">
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

      <p className="text-ink-muted">The stats pages and markets are under construction.</p>
    </div>
  );
}
