"use client";

import type { ReactElement, ReactNode } from "react";

import { formatKoreaTime, formatMinerals, formatProbability } from "@/lib/utils/format";

import { useMarket, useMyMarket } from "../hooks/use-market";
import { PriceChart } from "./PriceChart";
import { TradePanel } from "./TradePanel";

type Props = {
  slug: string;
  signInHref: string;
  /** Server-rendered context (player stats, head-to-head) shown under the market. */
  context?: ReactNode;
};

const STATUS: Record<string, string> = {
  open: "Open",
  closed: "Closed to trading",
  resolved: "Resolved",
  voided: "Voided: everyone was refunded",
};

export function MarketLive({ slug, signInHref, context }: Props): ReactElement {
  const market = useMarket(slug);
  const me = useMyMarket(slug);

  if (market.isPending) return <MarketSkeleton />;
  if (market.isError) {
    return <p role="alert">This market couldn&apos;t be loaded. Refresh to try again.</p>;
  }
  const m = market.data;
  const winner = m.resolvedOutcome === null ? undefined : m.outcomes[m.resolvedOutcome];

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-6">
        <p className="text-ink-muted">
          {STATUS[m.status]} · {m.status === "open" ? "Closes" : "Closed"}{" "}
          {formatKoreaTime(m.closesAt)} · {formatMinerals(m.volume)} traded by {m.traders}{" "}
          {m.traders === 1 ? "player" : "players"}
        </p>
        {winner ? (
          <p className="rounded-2xl bg-medal-gold px-4 py-3 text-race-ink">
            <strong>{winner.label}</strong> won. Each {winner.label} share paid 1 mineral.
            {m.resolutionNote ? ` ${m.resolutionNote}` : ""}
          </p>
        ) : null}
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {m.outcomes.map((o) => (
            <li key={o.idx} className="card p-5">
              <span className="block text-caption text-ink-muted">{o.label}</span>
              <span className="text-display tabular-nums">{formatProbability(o.price)}</span>
            </li>
          ))}
        </ul>
        <PriceChart labels={m.outcomes.map((o) => o.label)} history={m.history} />
        {m.description ? <p>{m.description}</p> : null}
        {context}
        <section aria-labelledby="trades-heading" className="flex flex-col gap-2">
          <h2 id="trades-heading">Recent trades</h2>
          {m.recentTrades.length === 0 ? (
            <p className="text-ink-muted">No trades yet. The first one sets the tone.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-data">
              {m.recentTrades.map((t) => (
                <li key={t.id}>
                  {t.trader} {t.shares > 0 ? "bought" : "sold"} {Math.abs(t.shares).toFixed(2)}{" "}
                  {m.outcomes[t.outcomeIdx]?.label ?? ""} for {formatMinerals(Math.abs(t.cost))} →{" "}
                  {formatProbability(t.priceAfter)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <TradePanel market={m} me={me.data} signInHref={signInHref} />
      </aside>
    </div>
  );
}

export function MarketSkeleton(): ReactElement {
  return (
    <div aria-busy="true" aria-label="Loading market" className="flex animate-pulse flex-col gap-4">
      <div className="h-5 w-2/3 rounded bg-surface-muted" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 rounded-lg bg-surface-muted" />
        <div className="h-24 rounded-lg bg-surface-muted" />
      </div>
      <div className="h-40 rounded-md bg-surface-muted" />
    </div>
  );
}
