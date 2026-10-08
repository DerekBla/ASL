/**
 * Finds dashes used in ordinary prose (Derek, 2026-10-07: no "-" in normal sentences).
 * Dashes in number notation are fine: scores 4–3, placements 9th–12th, records 16–2,
 * date ranges "Mar 23 – May 24, 2026", and a lone "–" standing for "no value" in a cell.
 */
const NUMERIC =
  /(\d(?:st|nd|rd|th)?|\d,\d{3}|[A-Z][a-z]{2} \d{1,2}),?\s?[-–—]\s?(\d|[A-Z][a-z]{2} \d)/;
/** Proper names that contain a hyphen and must be written exactly. */
const ALLOWED = new Set(["CC-BY-SA", "W–L"]);

export function proseDashes(text: string): string[] {
  const found: string[] = [];
  const clean = text.replace(/\s+/g, " ");
  for (const match of clean.matchAll(/\S*[-–—]\S*/g)) {
    const token = match[0].replace(/[.,:;()]+$/, "");
    if (ALLOWED.has(token)) continue;
    const at = match.index ?? 0;
    const window = clean.slice(Math.max(0, at - 8), at + match[0].length + 8);
    if (NUMERIC.test(window)) continue;
    if (/^[–—-]$/.test(token)) {
      // A lone dash between spaces is prose punctuation unless the whole cell is just "–".
      const around = clean.slice(Math.max(0, at - 1), at + 2);
      if (around.trim() === "–") continue;
    }
    found.push(clean.slice(Math.max(0, at - 25), at + match[0].length + 25).trim());
  }
  return found;
}

/** Visible text plus the text screen readers and tooltips use. */
export function readableText(root: HTMLElement): string {
  const attrs = [...root.querySelectorAll("[aria-label],[title],[placeholder],[alt]")].flatMap(
    (el) => ["aria-label", "title", "placeholder", "alt"].map((a) => el.getAttribute(a) ?? ""),
  );
  // Cells that hold only "–" mean "no value"; drop them so they don't read as prose.
  const parts = [
    ...root.querySelectorAll(
      "td,dd,span,p,li,h1,h2,h3,th,a,button,label,figcaption,summary,caption,strong,legend",
    ),
  ]
    .filter((el) => el.children.length === 0)
    .map((el) => el.textContent ?? "")
    .filter((t) => t.trim() !== "–");
  return [...parts, ...attrs].join(" \n ");
}
