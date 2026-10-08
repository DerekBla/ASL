"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FormEvent, ReactElement } from "react";

import { ASL_ROUNDS } from "@/lib/pickem/asl-format";
import type { PickemConfig } from "@/lib/pickem/types";
import { ACTION_ERROR_MESSAGES } from "@/lib/types/result";
import { fromKoreaLocal, toKoreaLocal } from "@/lib/utils/format";

import { Button } from "@/components/Button";

import { savePickemAction } from "../actions/pickem-admin";
import { entrantsToText, parseEntrants, parseRounds, roundsToText } from "../setup-text";

type Props = {
  /** An existing pick'em to edit. Left out for a new one. */
  existing?: { season: number; title: string; locksAt: string; config: PickemConfig };
};

type Draft = {
  season: string;
  title: string;
  locksAt: string; // datetime-local, interpreted as Korea time
  entrants: string;
  rounds: string;
};

function toDraft(existing: Props["existing"]): Draft {
  return {
    season: existing ? String(existing.season) : "",
    title: existing?.title ?? "",
    locksAt: existing ? toKoreaLocal(existing.locksAt) : "",
    entrants: existing ? entrantsToText(existing.config.entrants) : "",
    rounds: roundsToText(existing?.config.rounds ?? ASL_ROUNDS),
  };
}

/** Admin form: set up a season's pick'em, or edit one. */
export function PickemForm({ existing }: Props): ReactElement {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => toDraft(existing));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (field: keyof Draft) => (e: { target: { value: string } }) =>
    setDraft({ ...draft, [field]: e.target.value });

  function submit(event: FormEvent): void {
    event.preventDefault();
    const entrants = parseEntrants(draft.entrants);
    if ("error" in entrants) return setMessage(entrants.error);
    const rounds = parseRounds(draft.rounds);
    if ("error" in rounds) return setMessage(rounds.error);
    if (!draft.locksAt) return setMessage("Pick a lock time.");
    startTransition(async () => {
      const result = await savePickemAction({
        season: Number(draft.season),
        title: draft.title.trim() || `ASL Season ${draft.season} pick'em`,
        locksAt: fromKoreaLocal(draft.locksAt),
        entrants: entrants.data,
        rounds: rounds.data,
      });
      if ("error" in result) {
        setMessage(result.error.message ?? ACTION_ERROR_MESSAGES[result.error.code]);
        return;
      }
      setMessage(result.data.created ? "Pick'em created." : "Pick'em updated.");
      if (!existing) setDraft(toDraft(undefined));
      router.refresh();
    });
  }

  const field = "field";
  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3"
      aria-label={existing ? `Edit the season ${existing.season} pick'em` : "Create a pick'em"}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          Season
          <input
            inputMode="numeric"
            required
            readOnly={existing !== undefined}
            value={draft.season}
            onChange={set("season")}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1">
          Title (blank for the usual one)
          <input value={draft.title} onChange={set("title")} className={field} />
        </label>
        <label className="flex flex-col gap-1">
          Brackets lock (Korea time)
          <input
            type="datetime-local"
            required
            value={draft.locksAt}
            onChange={set("locksAt")}
            className={field}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        Players, one per line: &quot;Group | Player | Race&quot;. Race can be left out for a player
        the stats pages know. Use the group &quot;seed&quot; for players who start in the second
        round.
        <textarea
          required
          rows={8}
          value={draft.entrants}
          onChange={set("entrants")}
          placeholder={"A | Flash\nA | Rain\nseed | soma"}
          className={`${field} font-mono text-data`}
        />
      </label>
      <label className="flex flex-col gap-1">
        Rounds, one per line: &quot;key | Label | how many advance | points per pick | how many per
        group&quot;. The standard ASL format is filled in.
        <textarea
          required
          rows={5}
          value={draft.rounds}
          onChange={set("rounds")}
          className={`${field} font-mono text-data`}
        />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : existing ? "Save changes" : "Create pick'em"}
      </Button>
      {message ? (
        <p role="alert" className="notice">
          {message}
        </p>
      ) : null}
    </form>
  );
}
