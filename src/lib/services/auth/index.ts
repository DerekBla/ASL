/**
 * Who is signed in (Docs/integration-specs/clerk.md). Server only.
 *
 * getViewer() provisions on first use: the user row, their account and the 100-mineral grant
 * (ledger.ensureUser, idempotent). Admin status is read from Postgres, never from Clerk alone.
 */
import "server-only";

import { cache } from "react";

import { auth, currentUser } from "@clerk/nextjs/server";

import { isAuthEnabled, isMarketsEnabled } from "@/lib/config/env";
import { withWriteDb } from "@/lib/db/client";
import { ensureUser } from "@/lib/services/ledger";
import { userId as toUserId } from "@/lib/types/ids";
import type { UserId } from "@/lib/types/ids";

export type Viewer = { userId: UserId; isAdmin: boolean; created: boolean };

/** The Clerk user id of the signed-in visitor, without touching the database. */
export async function getSignedInUserId(): Promise<UserId | undefined> {
  if (!isAuthEnabled()) return undefined;
  const { userId } = await auth();
  return userId ? toUserId(userId) : undefined;
}

function displayNameOf(user: Awaited<ReturnType<typeof currentUser>>): string {
  if (!user) return "Player";
  return (
    user.username ??
    ([user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.primaryEmailAddress?.emailAddress.split("@")[0] ||
      "Player")
  );
}

/** The signed-in user, provisioned in our database. Cached for the request. */
export const getViewer = cache(async (): Promise<Viewer | undefined> => {
  if (!isMarketsEnabled()) return undefined;
  const id = await getSignedInUserId();
  if (!id) return undefined;
  return withWriteDb(async (db) => {
    const provisioned = await ensureUser(db, {
      userId: id,
      displayName: displayNameOf(await currentUser()),
    });
    return { userId: id, isAdmin: provisioned.isAdmin, created: provisioned.created };
  });
});
