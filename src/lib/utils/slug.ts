/**
 * URL slug for a player name: lowercase, runs of anything but a-z and 0-9 become one hyphen.
 * "force(Name)" -> "force-name", "SnOw" -> "snow". Names are unique ignoring case, and the
 * stats loader checks that slugs are unique too.
 */
export function playerSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
