import type { Metadata } from "next";
import type { ReactElement } from "react";

import { findPlayer, getHeadToHead } from "@/lib/services/stats";

import { HeadToHeadForm, HeadToHeadResult } from "@/features/stats";

export const metadata: Metadata = {
  title: "Head-to-head",
  description: "Every ASL series between two players, and how they placed in seasons both entered.",
};

type Props = {
  searchParams: Promise<{ a?: string | string[]; b?: string | string[] }>;
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function HeadToHeadPage({ searchParams }: Props): Promise<ReactElement> {
  const params = await searchParams;
  const a = first(params.a);
  const b = first(params.b);
  const h2h = a && b ? getHeadToHead(a, b) : undefined;

  let problem: string | null = null;
  if (a && b && !h2h) {
    const unknown = [a, b].filter((name) => !findPlayer(name));
    problem =
      unknown.length > 0
        ? `No ASL player called ${unknown.map((n) => `"${n}"`).join(" or ")}. Pick a name from the list.`
        : "Pick two different players.";
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1>Head-to-head</h1>
        <p className="text-ink-muted">
          Pick two players to see every ASL series between them and how they placed in seasons both
          entered. Old spellings work too (for example, BeSt finds Best).
        </p>
      </header>
      <HeadToHeadForm a={h2h?.a.player ?? a} b={h2h?.b.player ?? b} />
      {problem ? (
        <p role="alert" className="rounded-md border border-line bg-surface-muted p-3">
          {problem}
        </p>
      ) : null}
      {h2h ? <HeadToHeadResult h2h={h2h} /> : null}
    </div>
  );
}
