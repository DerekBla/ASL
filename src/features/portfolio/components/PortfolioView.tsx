import Link from "next/link";
import type { ReactElement } from "react";

import type { Portfolio } from "@/lib/services/markets-read";
import { formatKoreaTime, formatMinerals, formatProbability } from "@/lib/utils/format";

const STATUS: Record<string, string> = {
  open: "Open",
  closed: "Closed",
  resolved: "Resolved",
  voided: "Voided",
};

export function PortfolioView({ portfolio }: { portfolio: Portfolio }): ReactElement {
  const open = portfolio.positions.filter((p) => p.status === "open" || p.status === "closed");
  const settled = portfolio.positions.filter((p) => p.status === "resolved");
  const facts = [
    { label: "Minerals", value: formatMinerals(portfolio.balance) },
    { label: "Open positions", value: formatMinerals(open.reduce((s, p) => s + p.value, 0)) },
    { label: "Net worth", value: formatMinerals(portfolio.netWorth) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label} className="rounded-lg border border-line bg-surface-muted p-3">
            <dt className="text-caption text-ink-muted">{f.label}</dt>
            <dd className="text-heading tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="positions-heading" className="flex flex-col gap-2">
        <h2 id="positions-heading">Positions</h2>
        {open.length === 0 ? (
          <p className="text-ink-muted">
            No open positions. <Link href="/markets">Find a market</Link>.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {open.map((p) => (
              <li
                key={`${p.marketSlug}-${p.outcomeIdx}`}
                className="rounded-lg border border-line p-3"
              >
                <Link href={`/markets/${p.marketSlug}`}>{p.question}</Link>
                <p className="text-data tabular-nums">
                  {p.shares.toFixed(2)} {p.outcomeLabel} shares at {formatProbability(p.price)} ={" "}
                  {formatMinerals(p.value)} (cost {formatMinerals(p.costBasis)}) ·{" "}
                  {STATUS[p.status]}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {settled.length > 0 ? (
        <section aria-labelledby="settled-heading" className="flex flex-col gap-2">
          <h2 id="settled-heading">Settled</h2>
          <ul className="flex flex-col gap-1 text-data">
            {settled.map((p) => (
              <li key={`${p.marketSlug}-${p.outcomeIdx}`}>
                <Link href={`/markets/${p.marketSlug}`}>{p.question}</Link>: {p.shares.toFixed(2)}{" "}
                {p.outcomeLabel} {p.price === 1 ? `won, paid ${formatMinerals(p.shares)}` : "lost"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="history-heading" className="flex flex-col gap-2">
        <h2 id="history-heading">Trade history</h2>
        {portfolio.trades.length === 0 ? (
          <p className="text-ink-muted">No trades yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-data">
            {portfolio.trades.map((t) => (
              <li key={t.id}>
                {formatKoreaTime(t.at)}: {t.shares > 0 ? "bought" : "sold"}{" "}
                {Math.abs(t.shares).toFixed(2)} {t.outcomeLabel} for{" "}
                {formatMinerals(Math.abs(t.cost))} in{" "}
                <Link href={`/markets/${t.marketSlug}`}>{t.marketSlug}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-caption text-ink-muted">Your player id: {portfolio.userId}</p>
    </div>
  );
}
