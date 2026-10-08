"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FormEvent, ReactElement } from "react";

import { ACTION_ERROR_MESSAGES } from "@/lib/types/result";

import { Button } from "@/components/Button";

import { createLeagueAction, joinLeagueAction } from "../actions/draft";

type CreateProps = {
  /** Seasons whose players are announced and which have not started. */
  seasons: readonly { season: number; title: string }[];
};

/** Start a new draft league and land in its lobby. */
export function CreateLeagueForm({ seasons }: CreateProps): ReactElement {
  const router = useRouter();
  const [name, setName] = useState("");
  const [season, setSeason] = useState(seasons[0]?.season ?? 0);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent): void {
    event.preventDefault();
    startTransition(async () => {
      const result = await createLeagueAction({ season, name });
      if ("error" in result) {
        setMessage(result.error.message ?? ACTION_ERROR_MESSAGES[result.error.code]);
        return;
      }
      router.push(`/drafts/${result.data.leagueId}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-label="Start a draft">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          Draft name
          <input
            required
            minLength={3}
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field"
          />
        </label>
        <label className="flex flex-col gap-1">
          Season
          <select
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="field"
          >
            {seasons.map((s) => (
              <option key={s.season} value={s.season}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Start a draft"}
        </Button>
      </div>
      {message ? (
        <p role="alert" className="notice">
          {message}
        </p>
      ) : null}
    </form>
  );
}

/** The button on an invite page. */
export function JoinLeagueButton({ code }: { code: string }): ReactElement {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function join(): void {
    startTransition(async () => {
      const result = await joinLeagueAction({ code });
      if ("error" in result) {
        setMessage(result.error.message ?? ACTION_ERROR_MESSAGES[result.error.code]);
        return;
      }
      router.push(`/drafts/${result.data.leagueId}`);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button disabled={pending} onClick={join}>
          {pending ? "Joining…" : "Join this draft"}
        </Button>
      </div>
      {message ? (
        <p role="alert" className="notice">
          {message}
        </p>
      ) : null}
    </div>
  );
}
