"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FormEvent, ReactElement } from "react";

import { eloWinProbability, seriesWinProbability } from "@/lib/market/priors";
import { ACTION_ERROR_MESSAGES } from "@/lib/types/result";
import { fromKoreaLocal, toKoreaLocal } from "@/lib/utils/format";

import { Button } from "@/components/Button";

import { createMarketAction } from "../actions/market-admin";
import type { CreateMarketInput } from "../actions/market-admin";

type Props = {
  presets: readonly { name: string; input: CreateMarketInput }[];
  /** Current ELO by lowercased player name, for suggesting opening odds. */
  ratings?: Readonly<Record<string, number>>;
  /** How much of a rating gap to believe (manifest.elo.probabilityScale). */
  scale?: number;
};

/** "Label" or "Label | Player", one outcome per line. */
function parseOutcomes(text: string): { label: string; player: string | null }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label = "", player] = line.split("|").map((s) => s.trim());
      return { label, player: player ?? (label || null) };
    });
}

type Draft = {
  slug: string;
  question: string;
  description: string;
  b: string;
  closesAt: string; // datetime-local, interpreted as Korea time
  outcomes: string; // one per line: "Label" or "Label | Player"
  prior: string; // comma-separated percentages, optional
  season: string;
};

const EMPTY: Draft = {
  slug: "",
  question: "",
  description: "",
  b: "10",
  closesAt: "",
  outcomes: "",
  prior: "",
  season: "",
};

function toDraft(input: CreateMarketInput): Draft {
  return {
    slug: input.slug,
    question: input.question,
    description: input.description ?? "",
    b: String(input.b),
    closesAt: toKoreaLocal(input.closesAt),
    outcomes: input.outcomes
      .map((o) => (o.player && o.player !== o.label ? `${o.label} | ${o.player}` : o.label))
      .join("\n"),
    prior: (input.prior ?? []).map((p) => (p * 100).toFixed(1)).join(", "),
    season: input.season ? String(input.season) : "",
  };
}

export function CreateMarketForm({ presets, ratings = {}, scale = 1 }: Props): ReactElement {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [bestOf, setBestOf] = useState("7");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (field: keyof Draft) => (e: { target: { value: string } }) =>
    setDraft({ ...draft, [field]: e.target.value });

  function submit(event: FormEvent): void {
    event.preventDefault();
    const outcomes = parseOutcomes(draft.outcomes);
    const prior = draft.prior.trim()
      ? draft.prior.split(",").map((p) => Number(p) / 100)
      : undefined;
    if (!draft.closesAt) {
      setMessage("Pick a closing time.");
      return;
    }
    startTransition(async () => {
      const result = await createMarketAction({
        slug: draft.slug.trim(),
        question: draft.question.trim(),
        description: draft.description.trim(),
        b: Number(draft.b),
        closesAt: fromKoreaLocal(draft.closesAt),
        outcomes,
        ...(prior ? { prior } : {}),
        season: draft.season ? Number(draft.season) : null,
      });
      if ("error" in result) {
        setMessage(result.error.message ?? ACTION_ERROR_MESSAGES[result.error.code]);
        return;
      }
      setMessage(null);
      setDraft(EMPTY);
      router.push(`/markets/${result.data.slug}`);
    });
  }

  /** Fills the opening odds for a two player market from the players' current ELO. */
  function suggest(): void {
    const outcomes = parseOutcomes(draft.outcomes);
    const [a, b] = outcomes.map((o) => ratings[(o.player ?? "").toLowerCase()]);
    if (outcomes.length !== 2 || a === undefined || b === undefined) {
      setMessage("ELO odds need exactly two outcomes, each an ASL player.");
      return;
    }
    const pa = seriesWinProbability(eloWinProbability(a, b, scale), Number(bestOf));
    setMessage(null);
    setDraft({ ...draft, prior: [pa, 1 - pa].map((p) => (p * 100).toFixed(1)).join(", ") });
  }

  const field = "field";
  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-label="Create a market">
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Button key={p.name} variant="secondary" onClick={() => setDraft(toDraft(p.input))}>
            Fill in: {p.name}
          </Button>
        ))}
      </div>
      <label className="flex flex-col gap-1">
        Question
        <input required value={draft.question} onChange={set("question")} className={field} />
      </label>
      <label className="flex flex-col gap-1">
        URL slug (lowercase, hyphens)
        <input required value={draft.slug} onChange={set("slug")} className={field} />
      </label>
      <label className="flex flex-col gap-1">
        Outcomes, one per line (&quot;Label&quot;, or &quot;Label | Player&quot; to link a
        player&apos;s stats)
        <textarea
          required
          rows={3}
          value={draft.outcomes}
          onChange={set("outcomes")}
          className={field}
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          Closes (Korea time)
          <input
            type="datetime-local"
            required
            value={draft.closesAt}
            onChange={set("closesAt")}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1">
          Liquidity b (10 binary, 15 multi)
          <input
            inputMode="decimal"
            required
            value={draft.b}
            onChange={set("b")}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1">
          Season
          <input
            inputMode="numeric"
            value={draft.season}
            onChange={set("season")}
            className={field}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        Opening odds in %, comma-separated (blank for even; each is floored at 2%)
        <input value={draft.prior} onChange={set("prior")} className={field} />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          Series length
          <select value={bestOf} onChange={(e) => setBestOf(e.target.value)} className={field}>
            <option value="1">One game</option>
            <option value="3">Best of 3</option>
            <option value="5">Best of 5</option>
            <option value="7">Best of 7</option>
          </select>
        </label>
        <Button variant="secondary" onClick={suggest}>
          Suggest odds from ELO
        </Button>
      </div>
      <label className="flex flex-col gap-1">
        Rules and description
        <textarea
          rows={3}
          value={draft.description}
          onChange={set("description")}
          className={field}
        />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create market"}
      </Button>
      {message ? (
        <p role="alert" className="notice">
          {message}
        </p>
      ) : null}
    </form>
  );
}
