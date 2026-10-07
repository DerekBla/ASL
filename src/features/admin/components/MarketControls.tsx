"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ReactElement } from "react";

import { ACTION_ERROR_MESSAGES } from "@/lib/types/result";
import type { ActionResult } from "@/lib/types/result";
import { formatMinerals } from "@/lib/utils/format";

import { Button } from "@/components/Button";

import { closeMarketAction, resolveMarketAction, voidMarketAction } from "../actions/market-admin";

type Props = {
  marketId: number;
  slug: string;
  status: "open" | "closed" | "resolved" | "voided";
  outcomes: readonly { idx: number; label: string }[];
};

/** Close, resolve or void one market. Resolving and voiding ask for a second click. */
export function MarketControls({ marketId, slug, status, outcomes }: Props): ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [winner, setWinner] = useState(0);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState<"resolve" | "void" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (status === "resolved" || status === "voided") {
    return <p className="text-caption text-ink-muted">Settled ({status}).</p>;
  }

  function run(action: () => Promise<ActionResult<unknown>>, done: string): void {
    startTransition(async () => {
      const result = await action();
      setConfirming(null);
      if ("error" in result) {
        setMessage(result.error.message ?? ACTION_ERROR_MESSAGES[result.error.code]);
        return;
      }
      const paid = (result.data as { paidOut?: number }).paidOut;
      setMessage(paid === undefined ? done : `${done} ${formatMinerals(paid)} paid out.`);
      router.refresh();
    });
  }

  const winnerLabel = outcomes.find((o) => o.idx === winner)?.label ?? "";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        {status === "open" ? (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => closeMarketAction({ marketId, slug }), "Trading closed.")}
          >
            Close trading
          </Button>
        ) : null}
        <label className="flex flex-col gap-1 text-caption">
          Winner
          <select
            value={winner}
            onChange={(e) => setWinner(Number(e.target.value))}
            className="rounded-md border border-line bg-surface px-2 py-1"
          >
            {outcomes.map((o) => (
              <option key={o.idx} value={o.idx}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-caption">
          Note (result or reason)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-md border border-line bg-surface px-2 py-1"
          />
        </label>
        {confirming === "resolve" ? (
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () => resolveMarketAction({ marketId, slug, winningIdx: winner, note }),
                "Resolved.",
              )
            }
          >
            Confirm: {winnerLabel} won
          </Button>
        ) : (
          <Button variant="secondary" disabled={pending} onClick={() => setConfirming("resolve")}>
            Resolve
          </Button>
        )}
        {confirming === "void" ? (
          <Button
            disabled={pending}
            onClick={() =>
              run(() => voidMarketAction({ marketId, slug, note }), "Voided and refunded.")
            }
          >
            Confirm void and refund
          </Button>
        ) : (
          <Button variant="secondary" disabled={pending} onClick={() => setConfirming("void")}>
            Void
          </Button>
        )}
      </div>
      {message ? (
        <p role="status" className="text-caption">
          {message}
        </p>
      ) : null}
    </div>
  );
}
