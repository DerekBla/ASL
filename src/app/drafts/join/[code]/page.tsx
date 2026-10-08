import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";

import { isMarketsEnabled } from "@/lib/config/env";
import { getReadDb } from "@/lib/db/client";
import { getViewer } from "@/lib/services/auth";
import { getInvite } from "@/lib/services/draft";

import { DraftsOff, JoinLeagueButton } from "@/features/draft";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Join a draft", robots: { index: false } };

type Props = {
  params: Promise<{ code: string }>;
};

export default async function JoinDraftPage({ params }: Props): Promise<ReactElement> {
  if (!isMarketsEnabled()) return <DraftsOff />;
  const code = (await params).code;
  const invite = await getInvite(getReadDb(), code);
  if (!invite) notFound();
  const viewer = await getViewer();
  const isMember = invite.members.some((m) => m.userId === viewer?.userId);
  const league = `/drafts/${invite.id}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1>Join {invite.name}</h1>
        <p className="text-ink-muted">
          A fantasy draft for {invite.seasonTitle.replace(/ pick'em$/i, "")}. In it so far:{" "}
          {invite.members.map((m) => m.displayName).join(", ")}.
        </p>
      </header>
      {isMember ? (
        <p className="notice">
          You are already in this draft. <Link href={league}>Go to the draft</Link>
        </p>
      ) : invite.status !== "lobby" ? (
        <p className="notice">
          This draft has already started, so nobody new can join.{" "}
          <Link href={league}>Watch the draft</Link>
        </p>
      ) : invite.seasonStarted ? (
        <p className="notice">The season has started, so this draft is closed.</p>
      ) : viewer ? (
        <JoinLeagueButton code={code} />
      ) : (
        <p className="notice">
          <Link href={`/sign-in?redirect_url=${encodeURIComponent(`/drafts/join/${code}`)}`}>
            Sign in
          </Link>{" "}
          to join this draft.
        </p>
      )}
    </div>
  );
}
