"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactElement } from "react";

import { picksMade, togglePick, totalPicks } from "@/lib/pickem/bracket";
import type { PickemConfig, Selection } from "@/lib/pickem/types";
import { ACTION_ERROR_MESSAGES } from "@/lib/types/result";

import { Button } from "@/components/Button";

import { useSavePicks } from "../hooks/use-save-picks";
import { BracketPicker } from "./BracketPicker";

type Props = {
  season: number;
  config: PickemConfig;
  /** The bracket the user saved earlier, or {} for a new one. */
  initialPicks: Selection;
};

/** A fan's own bracket, editable until the pick'em locks. */
export function BracketEditor({ season, config, initialPicks }: Props): ReactElement {
  const router = useRouter();
  const [picks, setPicks] = useState<Selection>(initialPicks);
  const [message, setMessage] = useState<string | null>(null);
  const save = useSavePicks();

  const made = picksMade(config, picks);
  const total = totalPicks(config);

  function submit(): void {
    setMessage(null);
    save.mutate(
      { season, picks },
      {
        onSuccess: (result) => {
          if ("error" in result) {
            setMessage(result.error.message ?? ACTION_ERROR_MESSAGES[result.error.code]);
            return;
          }
          const { picksMade: saved, totalPicks: all } = result.data;
          setMessage(
            saved === all
              ? `Bracket saved. All ${all} picks are in.`
              : `Bracket saved with ${saved} of ${all} picks. You can finish it any time before the lock.`,
          );
          router.refresh();
        },
        onError: () => setMessage("Could not reach the site. Your bracket was not saved."),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <BracketPicker
        config={config}
        selection={picks}
        onToggle={(roundIdx, player) =>
          setPicks((current) => togglePick(config, current, roundIdx, player))
        }
        disabled={save.isPending}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save bracket"}
        </Button>
        <p className="text-caption text-ink-muted">
          {made} of {total} picks made
        </p>
      </div>
      <p role="status" aria-live="polite" className={message ? "notice" : "sr-only"}>
        {message}
      </p>
    </div>
  );
}
