/** Site-wide constants. No environment access here; env parsing lives in env.ts (later). */

export const SITE_NAME = "StarCoins";

export const SITE_DESCRIPTION =
  "A play money betting site for the ASL (StarCraft: Brood War), with every season's stats.";

/** Who made the site (Derek, 2026-10-07). His GitHub profile; the repo itself is private. */
export const AUTHOR_NAME = "stifle";
export const AUTHOR_URL = "https://github.com/DerekBla";

export const DISCLAIMER =
  "Unofficial fan project. Not affiliated with, endorsed by, or sponsored by the ASL, SOOP, AfreecaTV, or Blizzard Entertainment.";

/** Name of the play-money unit in UI copy. Code and the ledger call the same unit credits. */
export const CURRENCY_NAME = "minerals";

/** Every new account starts with this many minerals, granted once. */
export const SIGNUP_GRANT_CREDITS = 100;

/** Default LMSR liquidity, sized to a 100-mineral balance (ledger.md Defaults). */
export const DEFAULT_B_BINARY = 10;
export const DEFAULT_B_MULTI = 15;

export const PLAY_MONEY_NOTICE =
  "Markets use play money minerals only. Minerals have no monetary value and cannot be bought, sold, or exchanged.";

export const LIQUIPEDIA_URL = "https://liquipedia.net/starcraft/";
export const LIQUIPEDIA_LICENSE_URL = "https://creativecommons.org/licenses/by-sa/3.0/";
