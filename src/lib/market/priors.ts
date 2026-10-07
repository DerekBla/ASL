/**
 * Opening-price helpers (Docs/foundation-specs/market-engine.md). Pure.
 */

/** P(A beats B) from ELO ratings: 1 / (1 + 10^((R_B - R_A) / 400)). */
export function eloWinProbability(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/** A two-outcome prior from ELO, or even odds when a rating is missing. */
export function eloPrior(
  ratingA: number | undefined,
  ratingB: number | undefined,
): [number, number] {
  if (ratingA === undefined || ratingB === undefined) return [0.5, 0.5];
  const pa = eloWinProbability(ratingA, ratingB);
  return [pa, 1 - pa];
}
