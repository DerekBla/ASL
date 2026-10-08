"use client";

import Link from "next/link";
import type { ReactElement } from "react";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";

/** Header sign-in control. Client-side so every page can stay statically rendered. */
export function AccountMenu(): ReactElement {
  return (
    <div className="flex items-center gap-3">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            type="button"
            className="rounded-full bg-accent px-4 py-1.5 text-data font-medium text-on-accent shadow-soft transition hover:brightness-110"
          >
            Sign in
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <Link
          href="/portfolio"
          className="rounded-full px-3 py-1.5 text-data text-ink-muted no-underline hover:bg-surface-muted hover:text-ink hover:no-underline"
        >
          Portfolio
        </Link>
        <UserButton />
      </Show>
    </div>
  );
}
