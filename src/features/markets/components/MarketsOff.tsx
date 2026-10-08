import Link from "next/link";
import type { ReactElement } from "react";

/** Shown in place of market pages until the database and sign-in keys are configured. */
export function MarketsOff(): ReactElement {
  return (
    <div className="flex flex-col gap-3 notice px-5 py-4">
      <h2>Markets are warming up</h2>
      <p>
        StarCoins markets let you trade play money minerals on ASL matches. They switch on once the
        site&apos;s database and sign in are connected. Every new player starts with 100 minerals.
      </p>
      <p>
        Meanwhile, the <Link href="/seasons">stats</Link> and{" "}
        <Link href="/head-to-head">head to head</Link> pages work.
      </p>
    </div>
  );
}
