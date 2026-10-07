"use client";

import { useState } from "react";
import type { FormEvent, ReactElement } from "react";

import * as lmsr from "@/lib/market/lmsr";
import { useTradePanelStore } from "@/lib/stores/trade-panel-store";
import { ACTION_ERROR_MESSAGES } from "@/lib/types/result";
import { formatMinerals, formatProbability } from "@/lib/utils/format";

import { Button } from "@/components/Button";

import { usePlaceTrade } from "../hooks/use-market";
import type { MarketView, MyMarketState } from "../types";

type Props = {
  market: MarketView;
  me: MyMarketState | undefined;
  signInHref: string;
};

/** How far the server's price may move against the preview before the trade is refused. */
const SLIPPAGE = 0.02;

function quantities(market: MarketView): number[] {
  // Recover a q vector with the same prices (prices are all the panel needs for a preview).
  return market.outcomes.map((o) => market.b * Math.log(Math.max(o.price, 1e-12)));
}

/**
 * Buy or sell one outcome. The preview uses lmsr.ts locally for display only; the server
 * re-quotes inside the transaction and treats the preview as a slippage bound (money-3).
 */
export function TradePanel({ market, me, signInHref }: Props): ReactElement {
  const { selectedOutcome, side, amount, selectOutcome, setSide, setAmount } = useTradePanelStore();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const trade = usePlaceTrade(market.slug);

  if (market.status !== "open") {
    return (
      <p className="rounded-md border border-line bg-surface-muted p-4">
        Trading has closed on this market.
      </p>
    );
  }
  if (!me?.signedIn) {
    return (
      <p className="rounded-md border border-line bg-surface-muted p-4">
        <a href={signInHref}>Sign in</a> to trade. New players start with 100 minerals.
      </p>
    );
  }

  const outcome = market.outcomes[selectedOutcome] ?? market.outcomes[0];
  const held = me.shares[outcome?.idx ?? 0] ?? 0;
  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0;

  let preview: { shares: number; cost: number; priceAfter: number } | null = null;
  if (valid && outcome) {
    try {
      const q = quantities(market);
      if (side === "buy") {
        const quote = lmsr.quoteSpend(market.b, q, outcome.idx, value);
        preview = { shares: quote.shares, cost: quote.cost, priceAfter: quote.priceAfter };
      } else if (value <= held + 1e-9) {
        const quote = lmsr.quoteShares(market.b, q, outcome.idx, -value);
        preview = { shares: -value, cost: quote.cost, priceAfter: quote.priceAfter };
      }
    } catch {
      preview = null;
    }
  }

  function submit(event: FormEvent): void {
    event.preventDefault();
    if (!preview || !outcome) return;
    trade.mutate(
      {
        marketId: market.id,
        outcomeIdx: outcome.idx,
        mode: side === "buy" ? "buy_spend" : "sell_shares",
        amount: value,
        ...(side === "buy"
          ? { maxCost: value }
          : { minProceeds: Math.max(0, -preview.cost * (1 - SLIPPAGE)) }),
        idempotencyKey: key,
      },
      {
        onSuccess: (result) => {
          if ("data" in result) {
            setAmount("");
            setKey(crypto.randomUUID()); // a new trade gets a new key; a retry reuses the old one
          }
        },
      },
    );
  }

  const result = trade.data;
  const error = trade.isError
    ? ACTION_ERROR_MESSAGES.TEMPORARY_FAILURE
    : result && "error" in result
      ? ACTION_ERROR_MESSAGES[result.error.code]
      : null;

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-lg border border-line p-4"
      aria-label="Trade"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Outcome</legend>
        {market.outcomes.map((o) => (
          <label
            key={o.idx}
            className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2"
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name="outcome"
                checked={o.idx === outcome?.idx}
                onChange={() => selectOutcome(o.idx)}
              />
              {o.label}
            </span>
            <span className="tabular-nums">{formatProbability(o.price)}</span>
          </label>
        ))}
      </fieldset>

      <div className="flex gap-2" role="group" aria-label="Buy or sell">
        <Button
          variant={side === "buy" ? "primary" : "secondary"}
          aria-pressed={side === "buy"}
          onClick={() => setSide("buy")}
        >
          Buy
        </Button>
        <Button
          variant={side === "sell" ? "primary" : "secondary"}
          aria-pressed={side === "sell"}
          onClick={() => setSide("sell")}
        >
          Sell
        </Button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-caption text-ink-muted">
          {side === "buy" ? "Minerals to spend" : `Shares to sell (you hold ${held.toFixed(2)})`}
        </span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={side === "buy" ? "5" : "1"}
          className="rounded-md border border-line bg-surface px-3 py-2 tabular-nums"
        />
      </label>

      <div aria-live="polite" className="text-data">
        {preview ? (
          side === "buy" ? (
            <p>
              About {preview.shares.toFixed(2)} shares of {outcome?.label} for{" "}
              {formatMinerals(preview.cost)}. Price moves to {formatProbability(preview.priceAfter)}
              . Each share pays 1 mineral if {outcome?.label} wins.
            </p>
          ) : (
            <p>
              You get about {formatMinerals(-preview.cost)}. Price moves to{" "}
              {formatProbability(preview.priceAfter)}.
            </p>
          )
        ) : valid && side === "sell" ? (
          <p>You can only sell shares you hold.</p>
        ) : null}
        <p className="text-caption text-ink-muted">
          Balance: {me.balance === null ? "–" : formatMinerals(me.balance)}
        </p>
      </div>

      <Button type="submit" disabled={!preview || trade.isPending}>
        {trade.isPending
          ? "Placing trade…"
          : side === "buy"
            ? `Buy ${outcome?.label ?? ""}`
            : `Sell ${outcome?.label ?? ""}`}
      </Button>

      {error ? (
        <p role="alert" className="rounded-md border border-line bg-surface-muted p-3">
          {error}
        </p>
      ) : result && "data" in result ? (
        <p role="status" className="rounded-md border border-line bg-surface-muted p-3">
          {result.data.shares > 0
            ? `Bought ${result.data.shares.toFixed(2)} shares for ${formatMinerals(result.data.cost)}.`
            : `Sold ${(-result.data.shares).toFixed(2)} shares for ${formatMinerals(-result.data.cost)}.`}{" "}
          Balance: {formatMinerals(result.data.balance)}.
        </p>
      ) : null}
    </form>
  );
}
