import type { Metadata } from "next";
import type { ReactElement } from "react";

import { SignIn } from "@clerk/nextjs";

import { isAuthEnabled } from "@/lib/config/env";

import { MarketsOff } from "@/features/markets";

export const metadata: Metadata = { title: "Sign in" };

/** Clerk's sign-in (Discord and Google only, configured in the Clerk dashboard). */
export default function SignInPage(): ReactElement {
  return (
    <div className="flex flex-col items-center gap-4">
      {isAuthEnabled() ? <SignIn /> : <MarketsOff />}
      <p className="max-w-md text-center text-caption text-ink-muted">
        New players get 100 minerals to trade with. Minerals are play money: they can&apos;t be
        bought, sold or cashed out.
      </p>
    </div>
  );
}
