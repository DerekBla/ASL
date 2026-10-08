/**
 * The admin form writes a pick'em's players and rounds as plain lines of text. These turn
 * the lines into a setup and back.
 *
 * Players: "Group | Player | Race", race optional. Group "seed" means the player skips the
 * first round. Rounds: "key | Label | advance | points | per group", per group optional.
 */
import { SEED_GROUP } from "@/lib/pickem/asl-format";
import type { PickemEntrant, PickemRound } from "@/lib/pickem/types";
import { RACES } from "@/lib/types/race";
import type { Race } from "@/lib/types/race";

export type Parsed<T> = { data: T } | { error: string };

function cells(text: string): string[][] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("|").map((cell) => cell.trim()));
}

function toRace(cell: string | undefined): Race | null | undefined {
  if (!cell) return null;
  return RACES.find((r) => r === cell.toUpperCase());
}

export function parseEntrants(text: string): Parsed<PickemEntrant[]> {
  const entrants: PickemEntrant[] = [];
  for (const [group = "", player = "", raceCell] of cells(text)) {
    if (!group || !player) return { error: `Write each player as "Group | Player": ${group}` };
    const race = toRace(raceCell);
    if (race === undefined) return { error: `${player}: race must be T, Z or P.` };
    const seeded = group.toLowerCase() === SEED_GROUP;
    entrants.push({ player, race, group: seeded ? null : group, entersAt: seeded ? 1 : 0 });
  }
  return { data: entrants };
}

export function parseRounds(text: string): Parsed<PickemRound[]> {
  const rounds: PickemRound[] = [];
  for (const [key = "", label = "", advance, points, perGroup] of cells(text)) {
    const numbers = [advance, points, perGroup || undefined].map((n) =>
      n === undefined ? null : Number(n),
    );
    const [a, p, g = null] = numbers;
    if (!key || !label || !a || !p || numbers.some((n) => n !== null && !Number.isInteger(n)))
      return { error: `Write each round as "key | Label | advance | points": ${key}` };
    rounds.push({ key, label, advance: a, points: p, perGroup: g });
  }
  return { data: rounds };
}

export function entrantsToText(entrants: readonly PickemEntrant[]): string {
  return entrants
    .map((e) => [e.group ?? SEED_GROUP, e.player, ...(e.race ? [e.race] : [])].join(" | "))
    .join("\n");
}

export function roundsToText(rounds: readonly PickemRound[]): string {
  return rounds
    .map((r) =>
      [r.key, r.label, r.advance, r.points, ...(r.perGroup === null ? [] : [r.perGroup])].join(
        " | ",
      ),
    )
    .join("\n");
}
