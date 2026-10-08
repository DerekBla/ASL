/**
 * Counts game (map) wins per player in a Liquipedia season page's wikitext. Pure.
 *
 * Every played series is a {{Match}} with two {{1Opponent|Name}} and one {{Map|winner=1|2}}
 * per game. Games not played yet have no winner and count for nobody.
 */

/** The {{Match ...}} blocks of a page, each with its nested templates. */
function matchBlocks(wikitext: string): string[] {
  const blocks: string[] = [];
  let from = 0;
  for (;;) {
    const start = wikitext.indexOf("{{Match", from);
    if (start < 0) return blocks;
    // {{Matchlist}} only wraps matches; step inside it.
    if (!/^\{\{Match\s*[|}]/.test(wikitext.slice(start, start + 12))) {
      from = start + 7;
      continue;
    }
    let depth = 0;
    let at = start;
    while (at < wikitext.length) {
      if (wikitext.startsWith("{{", at)) {
        depth += 1;
        at += 2;
      } else if (wikitext.startsWith("}}", at)) {
        depth -= 1;
        at += 2;
        if (depth === 0) break;
      } else {
        at += 1;
      }
    }
    blocks.push(wikitext.slice(start, at));
    from = at;
  }
}

function opponent(block: string, side: 1 | 2): string | undefined {
  const match = new RegExp(`\\|\\s*opponent${side}\\s*=\\s*\\{\\{1Opponent\\|([^|}]+)`).exec(block);
  return match?.[1]?.trim() || undefined;
}

export type GameCount = {
  /** Game wins by player name, spelled as the page spells it. */
  wins: Record<string, number>;
  /** Games with a winner. */
  games: number;
  /** Series with at least one game played. */
  series: number;
};

export function countGameWins(wikitext: string): GameCount {
  const wins: Record<string, number> = {};
  let games = 0;
  let series = 0;
  for (const block of matchBlocks(wikitext)) {
    const players = [opponent(block, 1), opponent(block, 2)];
    let played = 0;
    for (const map of block.matchAll(/\|\s*map\d+\s*=\s*\{\{Map\|([^{}]*)\}\}/g)) {
      const winner = /(?:^|\|)\s*winner\s*=\s*([12])\s*(?:\||$)/.exec(map[1] ?? "")?.[1];
      const player = winner === "1" ? players[0] : winner === "2" ? players[1] : undefined;
      if (player === undefined) continue;
      wins[player] = (wins[player] ?? 0) + 1;
      played += 1;
    }
    games += played;
    if (played > 0) series += 1;
  }
  return { wins, games, series };
}
