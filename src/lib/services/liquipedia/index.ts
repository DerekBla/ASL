/**
 * Reads a page's wikitext from Liquipedia's MediaWiki API, live. Used only when an admin asks
 * for it; the stats pages still read data/generated/.
 *
 * API terms (https://liquipedia.net/api-terms-of-use): identify yourself with a User-Agent and
 * make at most one request every 2 seconds. One admin click is one request.
 */
import "server-only";

import { z } from "zod";

import { LIQUIPEDIA_URL } from "@/lib/config/site";
import { err, ok } from "@/lib/types/result";
import type { Result } from "@/lib/types/result";

export { countGameWins } from "./parse-games";
export type { GameCount } from "./parse-games";

const API = `${LIQUIPEDIA_URL}api.php`;
const USER_AGENT = "StarCoinsFanSite/0.1 (https://github.com/DerekBla/ASL; fan stats project)";

const responseSchema = z.object({
  query: z.object({
    pages: z
      .array(
        z.object({
          title: z.string(),
          missing: z.boolean().optional(),
          revisions: z
            .array(
              z.object({
                revid: z.number(),
                slots: z.object({ main: z.object({ content: z.string() }) }),
              }),
            )
            .optional(),
        }),
      )
      .min(1),
  }),
});

export type WikiPage = { title: string; url: string; revid: number; text: string };

export type WikiError = { code: "PAGE_NOT_FOUND" | "LIQUIPEDIA_UNAVAILABLE"; message: string };

export async function fetchWikitext(title: string): Promise<Result<WikiPage, WikiError>> {
  const query = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    redirects: "1",
    prop: "revisions",
    rvprop: "content|ids",
    rvslots: "main",
    titles: title,
  });
  const unavailable = (why: string): { error: WikiError } =>
    err({ code: "LIQUIPEDIA_UNAVAILABLE", message: `Liquipedia did not answer (${why}).` });
  let body: unknown;
  try {
    const response = await fetch(`${API}?${query}`, {
      headers: { "User-Agent": USER_AGENT, "Accept-Encoding": "gzip" },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return unavailable(`status ${response.status}`);
    body = await response.json();
  } catch (error) {
    return unavailable(error instanceof Error ? error.name : "network error");
  }
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) return unavailable("unexpected answer");
  const page = parsed.data.query.pages[0];
  const revision = page?.revisions?.[0];
  if (!page || page.missing || !revision)
    return err({ code: "PAGE_NOT_FOUND", message: `Liquipedia has no page called "${title}".` });
  return ok({
    title: page.title,
    url: LIQUIPEDIA_URL + encodeURI(page.title.replaceAll(" ", "_")),
    revid: revision.revid,
    text: revision.slots.main.content,
  });
}
