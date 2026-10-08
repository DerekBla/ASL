import Link from "next/link";
import type { ReactElement } from "react";

/** Shown in place of pick'em pages until the database and sign-in keys are configured. */
export function PickemOff(): ReactElement {
  return (
    <div className="flex flex-col gap-3 notice px-5 py-4">
      <h2>Pick&apos;em is warming up</h2>
      <p>
        Before each ASL season you fill out a bracket: who gets out of every round, all the way to
        the champion. It switches on once the site&apos;s database and sign in are connected.
      </p>
      <p>
        Meanwhile, the <Link href="/seasons">stats</Link> pages work.
      </p>
    </div>
  );
}
