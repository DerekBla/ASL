import { buildPool, teamSizeOptions, teamStandings } from "@/lib/draft/draft";
import type { LeagueView } from "@/lib/services/draft";

import { makePickemConfig } from "./pickem";

const MEMBERS = [
  { userId: "user_ann", displayName: "Ann" },
  { userId: "user_bo", displayName: "Bo" },
];

/** A two manager league in its lobby, owned by Ann and read by a member. */
export function makeLeagueView(overrides: Partial<LeagueView> = {}): LeagueView {
  const pool = buildPool(makePickemConfig(), ["soma", "Flash", "Soulkey", "Rain"]);
  return {
    id: 7,
    name: "ASL Boys",
    season: 23,
    seasonTitle: "ASL Season 23 pick'em",
    status: "lobby",
    seasonStarted: false,
    seasonComplete: false,
    ownerId: "user_ann",
    members: MEMBERS,
    teamSize: null,
    teamSizeOptions: teamSizeOptions(pool.length, MEMBERS.length),
    pool,
    order: null,
    picks: [],
    onClock: null,
    serverNow: "2027-01-05T10:00:00.000Z",
    standings: teamStandings(makePickemConfig(), {}, {}, MEMBERS, []),
    code: "invitecode12",
    ...overrides,
  };
}

/** The same league mid draft: Ann took soma, Bo is on the clock with 40 seconds left. */
export function makeDraftingLeague(overrides: Partial<LeagueView> = {}): LeagueView {
  const picks = [{ pickNo: 0, userId: "user_ann", player: "soma", auto: false }];
  return makeLeagueView({
    status: "drafting",
    teamSize: 2,
    order: ["user_ann", "user_bo"],
    picks,
    onClock: { userId: "user_bo", pickNo: 1, deadline: "2027-01-05T10:00:40.000Z" },
    standings: teamStandings(makePickemConfig(), {}, {}, MEMBERS, picks),
    ...overrides,
  });
}
