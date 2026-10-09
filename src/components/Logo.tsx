import type { ReactElement } from "react";

type Props = {
  /** Tailwind size classes, for example "size-7". */
  className?: string;
};

/**
 * The StarCoins mark: a gold coin with a star. Decorative; the site name next to it is the
 * label. The same drawing is the browser tab icon (src/app/icon.svg). Original artwork, not
 * taken from any game or league.
 */
export function Logo({ className = "size-7" }: Props): ReactElement {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <circle cx="16" cy="16" r="15" className="fill-coin-rim" />
      <circle cx="16" cy="16" r="12.5" className="fill-coin" />
      <polygon
        className="fill-coin-star"
        points="16,7.5 18.12,13.09 24.08,13.37 19.42,17.11 21,22.88 16,19.6 11,22.88 12.58,17.11 7.92,13.37 13.88,13.09"
      />
    </svg>
  );
}
