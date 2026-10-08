import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";

import { isMarketsEnabled } from "@/lib/config/env";
import { getReadDb } from "@/lib/db/client";
import { getViewer } from "@/lib/services/auth";
import { listMarkets } from "@/lib/services/markets-read";
import { formatKoreaTime, formatProbability } from "@/lib/utils/format";

import { CreateMarketForm, MarketControls, s22FinalPreset } from "@/features/admin";
import { MarketsOff } from "@/features/markets";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage(): Promise<ReactElement> {
  if (!isMarketsEnabled()) return <MarketsOff />;
  const viewer = await getViewer();
  if (!viewer?.isAdmin) {
    return (
      <div className="flex flex-col gap-3">
        <h1>Admin</h1>
        <p>Only admins can manage markets.</p>
      </div>
    );
  }
  const markets = await listMarkets(getReadDb());

  return (
    <div className="flex flex-col gap-10">
      <h1>Admin</h1>
      <section aria-labelledby="create-heading" className="flex flex-col gap-3">
        <h2 id="create-heading">New market</h2>
        <CreateMarketForm presets={[{ name: "ASL S22 Grand Final", input: s22FinalPreset() }]} />
      </section>
      <section aria-labelledby="manage-heading" className="flex flex-col gap-4">
        <h2 id="manage-heading">Markets</h2>
        {markets.length === 0 ? <p className="text-ink-muted">No markets yet.</p> : null}
        {markets.map((m) => (
          <article key={m.slug} className="flex flex-col gap-2 card p-5">
            <Link href={`/markets/${m.slug}`} className="text-heading">
              {m.question}
            </Link>
            <p className="text-caption text-ink-muted">
              {m.status} · closes {formatKoreaTime(m.closesAt)} ·{" "}
              {m.outcomes.map((o) => `${o.label} ${formatProbability(o.price)}`).join(" · ")}
            </p>
            <MarketControls marketId={m.id} slug={m.slug} status={m.status} outcomes={m.outcomes} />
          </article>
        ))}
      </section>
    </div>
  );
}
