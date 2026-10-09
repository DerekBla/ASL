/**
 * Opening-price helpers (Docs/foundation-specs/market-engine.md). Pure.
 */

/**
 * P(A beats B) from ELO ratings: 1 / (1 + 10^(scale * (R_B - R_A) / 400)). `scale` is how much
 * of the gap to believe; the stats export fits it to the games played (manifest.elo
 * .probabilityScale) because the plain formula, scale 1, overstates the favorite in the ASL.
 */
export function eloWinProbability(ratingA: number, ratingB: number, scale = 1): number {
  return 1 / (1 + 10 ** ((scale * (ratingB - ratingA)) / 400));
}

/**
 * P(win a best of N) from the chance of winning one game, with every game independent: the
 * first to (N + 1) / 2 wins takes it. A best of 1 is the game itself.
 */
export function seriesWinProbability(gameProbability: number, bestOf: number): number {
  const need = Math.floor(bestOf / 2) + 1;
  const p = gameProbability;
  let total = 0;
  // Win the last game after losing k of the games before it: C(need - 1 + k, k) orders.
  let orders = 1;
  for (let k = 0; k < need; k += 1) {
    total += orders * p ** need * (1 - p) ** k;
    orders = (orders * (need + k)) / (k + 1);
  }
  return total;
}

/** A two-outcome prior from ELO, or even odds when a rating is missing. */
export function eloPrior(
  ratingA: number | undefined,
  ratingB: number | undefined,
  scale = 1,
): [number, number] {
  if (ratingA === undefined || ratingB === undefined) return [0.5, 0.5];
  const pa = eloWinProbability(ratingA, ratingB, scale);
  return [pa, 1 - pa];
}
