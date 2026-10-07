/**
 * The one place numeric(18,6) strings become numbers and back (ledger-writes.md: Conversions).
 */

const MICRO = 1_000_000;

export function toNumber(value: string | number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new RangeError(`not a finite numeric value: ${value}`);
  return n;
}

/** A number as a numeric(18,6) literal, rounded to the nearest micro-credit. */
export function toNumeric(n: number): string {
  if (!Number.isFinite(n)) throw new RangeError(`not a finite number: ${n}`);
  const micro = Math.round(n * MICRO);
  return (micro / MICRO).toFixed(6);
}

/** A probability as a numeric(10,8) literal. */
export function toPrice(p: number): string {
  return p.toFixed(8);
}

/** Shares are stored to 6 decimals; round down so a trade never exceeds what was asked for. */
export function floorShares(x: number): number {
  return Math.floor(x * MICRO + 1e-6) / MICRO;
}
