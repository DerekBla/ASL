/** Display formatting. Pure functions; every page formats numbers through these. */

const integer = new Intl.NumberFormat("en-US");
const oneDecimal = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const monthDay = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const monthDayYear = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatInteger(n: number): string {
  return integer.format(n);
}

/** Prize money in Korean won: "₩78,000,000". */
export function formatKrw(n: number | null): string {
  return n === null ? "–" : `₩${integer.format(n)}`;
}

/** ELO with one decimal, as the old spreadsheet showed it: "2,181.9". */
export function formatElo(n: number): string {
  return oneDecimal.format(n);
}

/** A 0–1 ratio as a percentage with one decimal: 0.5233 -> "52.3%". */
export function formatPercent(ratio: number | null): string {
  return ratio === null ? "–" : `${oneDecimal.format(ratio * 100)}%`;
}

/** Series score with an en-dash: "4-3" -> "4–3". */
export function formatScore(score: string | null): string {
  return score === null ? "" : score.replace("-", "–");
}

/** "S21". */
export function formatSeason(season: number): string {
  return `S${season}`;
}

/** ISO dates to "Mar 23 – May 24, 2026" (or with both years when they differ). */
export function formatDateRange(start: string, end: string): string {
  const a = new Date(`${start}T00:00:00Z`);
  const b = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return `${start} – ${end}`;
  const first =
    a.getUTCFullYear() === b.getUTCFullYear() ? monthDay.format(a) : monthDayYear.format(a);
  return `${first} – ${monthDayYear.format(b)}`;
}

const minerals = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** Play-money amounts: at most 2 decimals, always labelled minerals (conventions). */
export function formatMinerals(n: number): string {
  const rounded = Math.abs(n) < 0.005 ? 0 : n;
  return `${minerals.format(rounded)} ${Math.abs(rounded) === 1 ? "mineral" : "minerals"}`;
}

/** A probability as a whole-number percentage: 0.623 -> "62%". Never shows 0% or 100% for an open price. */
export function formatProbability(p: number): string {
  if (p > 0 && p < 0.01) return "<1%";
  if (p < 1 && p > 0.99) return ">99%";
  return `${Math.round(p * 100)}%`;
}

const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
  timeZoneName: "short",
});

/** A moment in Korea time, since ASL is broadcast from Seoul: "Oct 17, 3:00 PM GMT+9". */
export function formatKoreaTime(iso: string): string {
  return dateTime.format(new Date(iso));
}
