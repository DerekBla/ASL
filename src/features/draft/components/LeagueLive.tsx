"use client";

import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { PICK_SECONDS, totalDraftPicks } from "@/lib/draft/draft";
import { queryKeys } from "@/lib/queries/query-keys";
import type { LeagueView } from "@/lib/services/draft";
import { ACTION_ERROR_MESSAGES } from "@/lib/types/result";
import type { ActionResult } from "@/lib/types/result";

import { Button } from "@/components/Button";
import { RaceBadge } from "@/components/RaceBadge";

import { makePickAction, startDraftAction } from "../actions/draft";
import { useLeague, useSecondsLeft } from "../hooks/use-league";
import { useTurnDing } from "../hooks/use-turn-ding";

type Props = {
  initial: LeagueView;
  /** The signed in reader, if any. */
  viewerId?: string | undefined;
};

type Panel = { league: LeagueView; viewerId: string | undefined };

/** Runs a draft action, shows why it was refused, and refetches the league either way. */
function useLeagueAction(leagueId: number): {
  run: (action: () => Promise<ActionResult<unknown>>) => void;
  pending: boolean;
  message: string | null;
} {
  const client = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (action: () => Promise<ActionResult<unknown>>) => action(),
    onSuccess: (result) =>
      setMessage(
        "error" in result
          ? (result.error.message ?? ACTION_ERROR_MESSAGES[result.error.code])
          : null,
      ),
    onError: () => setMessage("Could not reach the site. Try again."),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.drafts.detail(leagueId) }),
  });
  return { run: (action) => mutation.mutate(action), pending: mutation.isPending, message };
}

const nameOf = (league: LeagueView, userId: string): string =>
  league.members.find((m) => m.userId === userId)?.displayName ?? "Someone";

function InviteLink({ code }: { code: string }): ReactElement {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/drafts/join/${code}`;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        Invite link. Anyone with an account who opens it can join.
        <input readOnly value={url} onFocus={(e) => e.target.select()} className="field" />
      </label>
      <Button
        variant="secondary"
        onClick={() => void navigator.clipboard.writeText(url).then(() => setCopied(true))}
      >
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}

function Lobby({ league, viewerId }: Panel): ReactElement {
  const options = league.teamSizeOptions;
  const [teamSize, setTeamSize] = useState<number | null>(null);
  const { run, pending, message } = useLeagueAction(league.id);
  // Default to the biggest teams the pool allows, and follow it down as people join.
  const size = teamSize !== null && options.includes(teamSize) ? teamSize : (options.at(-1) ?? 1);
  const isOwner = league.ownerId === viewerId;

  return (
    <section aria-labelledby="lobby-heading" className="flex flex-col gap-4">
      <h2 id="lobby-heading">Lobby</h2>
      {league.seasonStarted ? (
        <p className="notice">
          The season started before this draft did, so it can no longer be held.
        </p>
      ) : (
        <p className="text-ink-muted">
          Waiting for the draft to start. Once it does, the order is drawn at random and everyone
          gets {PICK_SECONDS} seconds for each pick.
        </p>
      )}
      <div>
        <h3>Managers ({league.members.length})</h3>
        <ul className="list-disc pl-6">
          {league.members.map((m) => (
            <li key={m.userId}>
              {m.displayName}
              {m.userId === league.ownerId ? " (runs the draft)" : ""}
              {m.userId === viewerId ? " (you)" : ""}
            </li>
          ))}
        </ul>
      </div>
      {league.code && !league.seasonStarted ? <InviteLink code={league.code} /> : null}
      {isOwner && !league.seasonStarted ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            Players on each team
            <select
              value={size}
              onChange={(e) => setTeamSize(Number(e.target.value))}
              className="field"
            >
              {options.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={pending || league.members.length < 2}
            onClick={() => run(() => startDraftAction({ leagueId: league.id, teamSize: size }))}
          >
            {pending ? "Starting…" : "Start the draft"}
          </Button>
          <p className="text-caption text-ink-muted">
            {league.members.length < 2
              ? "Invite at least one more person first."
              : `${league.pool.length} players, ${league.members.length} managers: up to ${options.at(-1)} each.`}
          </p>
        </div>
      ) : null}
      <p role="alert" className={message ? "notice" : "sr-only"}>
        {message}
      </p>
    </section>
  );
}

function Clock({ league, fetchedAt }: { league: LeagueView; fetchedAt: number }): ReactElement {
  const onClock = league.onClock;
  const seconds = useSecondsLeft(
    onClock?.deadline ?? league.serverNow,
    league.serverNow,
    fetchedAt,
  );
  return (
    <span className="text-heading tabular-nums" aria-label={`${seconds} seconds left`}>
      0:{String(seconds).padStart(2, "0")}
    </span>
  );
}

function DraftRoom({ league, viewerId, fetchedAt }: Panel & { fetchedAt: number }): ReactElement {
  const { run, pending, message } = useLeagueAction(league.id);
  const onClock = league.onClock;
  const myTurn = onClock !== null && onClock.userId === viewerId;
  const taken = new Set(league.picks.map((p) => p.player));
  const members = league.members.length;
  const total = totalDraftPicks(members, league.teamSize ?? 0);
  const pickNo = league.picks.length;
  const isManager = league.members.some((m) => m.userId === viewerId);
  const ding = useTurnDing(myTurn, pickNo);

  return (
    <section aria-labelledby="draft-heading" className="flex flex-col gap-4">
      <h2 id="draft-heading">Draft</h2>
      {onClock ? (
        <div className="flex flex-wrap items-center justify-between gap-3 notice" role="status">
          <p>
            <strong>
              {myTurn ? "Your pick." : `${nameOf(league, onClock.userId)} is picking.`}
            </strong>{" "}
            Pick {pickNo + 1} of {total}, round {Math.floor(pickNo / members) + 1} of{" "}
            {league.teamSize}.
          </p>
          <Clock league={league} fetchedAt={fetchedAt} />
        </div>
      ) : null}
      <p className="text-caption text-ink-muted">
        If the clock runs out, the highest rated player still free is picked for you.
      </p>
      {isManager ? (
        <label className="flex items-center gap-2 text-caption">
          <input
            type="checkbox"
            checked={ding.enabled}
            onChange={(e) => ding.setEnabled(e.target.checked)}
          />
          Play a sound when it is my pick
        </label>
      ) : null}
      <div>
        <h3>Players left</h3>
        <ul className="flex flex-wrap gap-1.5 pt-1">
          {league.pool
            .filter((p) => !taken.has(p.player))
            .map((p) => (
              <li key={p.player}>
                <button
                  type="button"
                  disabled={!myTurn || pending}
                  onClick={() =>
                    run(() => makePickAction({ leagueId: league.id, player: p.player }))
                  }
                  aria-label={`Draft ${p.player}`}
                  className="inline-flex items-center gap-1.5 rounded border border-line-strong bg-card px-2 py-1 text-data transition enabled:hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RaceBadge race={p.race} />
                  {p.player}
                </button>
              </li>
            ))}
        </ul>
      </div>
      <p role="alert" className={message ? "notice" : "sr-only"}>
        {message}
      </p>
    </section>
  );
}

function Teams({ league, viewerId }: Panel): ReactElement {
  const race = new Map(league.pool.map((p) => [p.player, p.race]));
  const scored = league.status === "drafted";
  return (
    <section aria-labelledby="teams-heading" className="flex flex-col gap-3">
      <h2 id="teams-heading">{scored ? "Standings" : "Teams so far"}</h2>
      {scored ? (
        <p className="text-caption text-ink-muted">
          A team scores 1 point for every game one of its players wins this season.{" "}
          {league.seasonComplete
            ? "The season is over, so these standings are final."
            : "Points are added as results come in."}
        </p>
      ) : null}
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {league.standings.map((team) => (
          <li key={team.userId} className="flex flex-col gap-2 card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h3>
                {scored ? `${team.rank}. ` : ""}
                {team.displayName}
                {team.userId === viewerId ? " (you)" : ""}
              </h3>
              {scored ? (
                <p className="font-semibold">
                  {team.points} {team.points === 1 ? "point" : "points"}
                </p>
              ) : null}
            </div>
            {team.champion ? (
              <p>
                <span
                  title="Won this draft league"
                  className="rounded border border-line-strong bg-medal-gold px-1.5 text-caption font-semibold text-race-ink"
                >
                  Draft champion
                </span>
              </p>
            ) : null}
            {team.players.length === 0 ? (
              <p className="text-ink-muted">No picks yet.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {team.players.map((p) => (
                  <li key={p.player} className="flex items-center gap-1.5 text-data">
                    <RaceBadge race={race.get(p.player) ?? null} />
                    <span className={p.out ? "text-ink-muted" : ""}>{p.player}</span>
                    {p.out ? <span className="text-caption text-ink-muted">(out)</span> : null}
                    {scored ? <span className="ml-auto tabular-nums">{p.points}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      {league.picks.length > 0 ? (
        <details>
          <summary>Every pick in order</summary>
          <ol className="list-decimal pt-2 pl-8 text-data">
            {league.picks.map((p) => (
              <li key={p.pickNo}>
                {nameOf(league, p.userId)}: {p.player}
                {p.auto ? " (picked by the clock)" : ""}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}

/** A draft league from lobby to final standings. Polls while people are joining or drafting. */
export function LeagueLive({ initial, viewerId }: Props): ReactElement {
  const query = useLeague(initial);
  const league = query.data ?? initial;
  return (
    <div className="flex flex-col gap-8">
      {league.status === "lobby" ? <Lobby league={league} viewerId={viewerId} /> : null}
      {league.status === "drafting" ? (
        <DraftRoom league={league} viewerId={viewerId} fetchedAt={query.dataUpdatedAt} />
      ) : null}
      {league.status === "lobby" ? null : <Teams league={league} viewerId={viewerId} />}
    </div>
  );
}
