/**
 * Download recent ladder replays of chosen pro players from cwal.gg (network).
 *
 *   pnpm replays:fetch
 *
 * For each player in PLAYERS it finds the ladder accounts cwal.gg lists under that pro id, reads
 * their recent matches, skips games that ended almost at once (a leaver or a dodge) and saves the
 * newest GAMES_PER_PLAYER replays played as the player's own race into public/replays/<player>/. The list of what was saved goes
 * to data/source/cwal/replays.json, which `pnpm replays:export` reads.
 *
 * Be polite: one request at a time with a pause, and an identified User-Agent.
 */
import { access, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const API = "https://api.aws.cwal.gg";
const USER_AGENT = "StarCoins fan site (replay build orders; github.com/DerekBla/ASL)";
const PAUSE_MS = 400;

/**
 * Pro ids as cwal.gg writes them. The slug names the folder and links the ASL player page.
 * `race` keeps only the games the player played as that race: pros ladder off race too, and
 * Derek wants their own race (2026-10-12, after Rush's newest ten all came back as Zerg).
 */
const PLAYERS: readonly { proId: string; slug: string; race: "T" | "Z" | "P" }[] = [
  { proId: "Rush", slug: "rush", race: "T" },
  { proId: "Light", slug: "light", race: "T" },
];

const GAMES_PER_PLAYER = 10;
/** Shorter games count as an instant leave and are skipped. */
const MIN_DURATION_SECONDS = 120;
const MATCH_PAGES_PER_ACCOUNT = 3;

type SearchResult = { proId: string | null; gateway: number; toon: string };
type Handle = { gateway: number; toon: string; proId?: string | null };
type Match = {
  matchId: string;
  timestamp: number;
  duration: number;
  mapName: string;
  race: string;
  opponentRace: string;
  result: string;
  mmr?: number;
  opponentMmr?: number;
  opponentToon: string;
  opponentProId?: string | null;
};

export type SavedReplay = {
  id: string;
  matchId: string;
  pro: string;
  proSlug: string;
  toon: string;
  gateway: number;
  playedAt: string;
  durationSeconds: number;
  map: string;
  result: "win" | "loss";
  mmr: number | null;
  opponentToon: string;
  opponentPro: string | null;
  opponentMmr: number | null;
  file: string;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function get(url: string): Promise<Response> {
  await sleep(PAUSE_MS);
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response;
}

async function getJson<T>(pathAndQuery: string): Promise<T> {
  return (await (await get(`${API}${pathAndQuery}`)).json()) as T;
}

/** Map names carry StarCraft color codes (control characters); drop them. */
function cleanMapName(name: string): string {
  // eslint-disable-next-line no-control-regex
  return name.replace(/[\u0000-\u001f]/g, "").trim();
}

async function accountsOf(proId: string): Promise<Handle[]> {
  const search = await getJson<{ results: SearchResult[] }>(
    `/api/search?q=${encodeURIComponent(proId)}`,
  );
  const seeds = search.results.filter((r) => r.proId === proId);
  const accounts = new Map<string, Handle>();
  for (const seed of seeds) {
    accounts.set(`${seed.gateway}/${seed.toon.toLowerCase()}`, seed);
    // Each Battle.net account can hold several ladder names; cwal.gg lists them together.
    const profile = await getJson<{ profile?: { auroraId?: number } }>(
      `/api/player/${seed.gateway}/${encodeURIComponent(seed.toon)}`,
    );
    const auroraId = profile.profile?.auroraId;
    if (auroraId === undefined) continue;
    const { handles } = await getJson<{ handles: Handle[] }>(`/api/account/${auroraId}/handles`);
    for (const handle of handles) {
      accounts.set(`${handle.gateway}/${handle.toon.toLowerCase()}`, handle);
    }
  }
  return [...accounts.values()];
}

async function recentMatches(account: Handle): Promise<(Match & Handle)[]> {
  const matches: (Match & Handle)[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MATCH_PAGES_PER_ACCOUNT; page++) {
    const query: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
    const body: { matches: Match[]; nextCursor?: string | null } = await getJson(
      `/api/player/${account.gateway}/${encodeURIComponent(account.toon)}/matches?limit=25${query}`,
    );
    for (const match of body.matches) {
      matches.push({ ...match, gateway: account.gateway, toon: account.toon });
    }
    cursor = body.nextCursor ?? null;
    if (!cursor) break;
  }
  return matches;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const saved: SavedReplay[] = [];

  for (const player of PLAYERS) {
    const accounts = await accountsOf(player.proId);
    console.warn(`${player.proId}: ${accounts.map((a) => a.toon).join(", ")}`);

    const matches: (Match & Handle)[] = [];
    for (const account of accounts) matches.push(...(await recentMatches(account)));
    matches.sort((a, b) => b.timestamp - a.timestamp);

    const dir = path.join(root, "public", "replays", player.slug);
    await mkdir(dir, { recursive: true });
    const kept = new Set<string>();
    const seen = new Set<string>();
    let count = 0;

    for (const match of matches) {
      if (count >= GAMES_PER_PLAYER) break;
      if (seen.has(match.matchId)) continue;
      seen.add(match.matchId);
      if (match.duration < MIN_DURATION_SECONDS) continue;
      if (match.race !== player.race) continue;
      if (match.result !== "win" && match.result !== "loss") continue;

      // "MM-BE84E84C-C574-11F1-..." -> "be84e84c-c574": short, and still unique per game.
      const id = match.matchId.replace(/^MM-/, "").split("-").slice(0, 2).join("-").toLowerCase();
      const fileName = `${id}.rep`;
      // A replay never changes, so one already stored is not downloaded again.
      const stored = await access(path.join(dir, fileName)).then(
        () => true,
        () => false,
      );
      if (!stored) {
        try {
          const response = await get(`${API}/api/replay/${encodeURIComponent(match.matchId)}/file`);
          await writeFile(path.join(dir, fileName), Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          console.warn(`  no replay for ${match.matchId}: ${String(error)}`);
          continue;
        }
      }
      kept.add(fileName);
      count++;
      saved.push({
        id,
        matchId: match.matchId,
        pro: player.proId,
        proSlug: player.slug,
        toon: match.toon,
        gateway: match.gateway,
        playedAt: new Date(match.timestamp).toISOString(),
        durationSeconds: match.duration,
        map: cleanMapName(match.mapName),
        result: match.result,
        mmr: match.mmr ?? null,
        opponentToon: match.opponentToon,
        opponentPro: match.opponentProId ?? null,
        opponentMmr: match.opponentMmr ?? null,
        file: `/replays/${player.slug}/${fileName}`,
      });
      console.warn(`  ${new Date(match.timestamp).toISOString()} ${match.result} vs ${match.opponentToon}`);
    }

    // Replays that fell out of the newest ten are removed, so the folder matches the list.
    for (const name of await readdir(dir)) {
      if (name.endsWith(".rep") && !kept.has(name)) await rm(path.join(dir, name));
    }
    if (count < GAMES_PER_PLAYER) console.warn(`  only ${count} games found for ${player.proId}`);
  }

  const out = path.join(root, "data", "source", "cwal");
  await mkdir(out, { recursive: true });
  const body = { source: "https://cwal.gg", minDurationSeconds: MIN_DURATION_SECONDS, replays: saved };
  await writeFile(path.join(out, "replays.json"), `${JSON.stringify(body, null, 2)}\n`);
  console.warn(`saved ${saved.length} replays`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
