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
            className="rounded-md border border-line px-3 py-1 font-semibold hover:border-accent"
          >
            Sign in
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <Link href="/portfolio" className="text-ink no-underline hover:text-accent">
          Portfolio
        </Link>
        <UserButton />
      </Show>
    </div>
  );
}
