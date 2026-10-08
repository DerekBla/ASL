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
            className="rounded bg-card px-3 py-1 text-data font-semibold text-accent transition hover:bg-nav-hover hover:text-on-nav-hover"
          >
            Sign in
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <Link
          href="/portfolio"
          className="rounded px-2.5 py-1.5 text-data font-semibold text-on-nav/90 no-underline hover:bg-nav-hover hover:text-on-nav-hover hover:no-underline"
        >
          Portfolio
        </Link>
        <UserButton />
      </Show>
    </div>
  );
}
