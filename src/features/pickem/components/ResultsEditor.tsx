"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ReactElement } from "react";

import { togglePick } from "@/lib/pickem/bracket";
import type { PickemConfig, Selection } from "@/lib/pickem/types";
import { ACTION_ERROR_MESSAGES } from "@/lib/types/result";

import { Button } from "@/components/Button";

import { saveResultsAction } from "../actions/pickem-admin";
import { BracketPicker } from "./BracketPicker";

type Props = {
  season: number;
  config: PickemConfig;
  results: Selection;
  note: string | null;
};

/**
 * Admin: mark who really advanced from each round. Rounds can be saved half filled as the
 * season is played; every bracket is rescored from whatever is saved here.
 */
export function ResultsEditor({ season, config, results, note }: Props): ReactElement {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection>(results);
  const [source, setSource] = useState(note ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(): void {
    startTransition(async () => {
      const result = await saveResultsAction({ season, results: selection, note: source });
      if ("error" in result) {
        setMessage(result.error.message ?? ACTION_ERROR_MESSAGES[result.error.code]);
        return;
      }
      setMessage(
        result.data.status === "complete"
          ? "Results saved. The season is decided and final standings are up."
          : "Results saved. Brackets are rescored.",
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <BracketPicker
        config={config}
        selection={selection}
        onToggle={(roundIdx, player) =>
          setSelection((current) => togglePick(config, current, roundIdx, player))
        }
        disabled={pending}
      />
      <label className="flex flex-col gap-1 text-caption">
        Source for these results (a Liquipedia link)
        <input value={source} onChange={(e) => setSource(e.target.value)} className="field" />
      </label>
      <div>
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save results"}
        </Button>
      </div>
      {message ? (
        <p role="status" className="text-caption">
          {message}
        </p>
      ) : null}
    </div>
  );
}
