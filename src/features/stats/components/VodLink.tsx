import type { ReactElement } from "react";

type Props = {
  url: string;
  /** What the cast covers, for screen readers: "Group A", "soma against herO". */
  of: string;
  /** Visible text. Defaults to "VOD". */
  label?: string;
};

/** A small button that opens the English cast of a group or series on YouTube in a new tab. */
export function VodLink({ url, of, label = "VOD" }: Props): ReactElement {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}: watch ${of} on YouTube`}
      className="inline-flex shrink-0 items-center gap-1 rounded border border-line-strong bg-card px-1.5 text-caption leading-5 font-semibold text-link no-underline hover:bg-surface-muted hover:no-underline"
    >
      <span aria-hidden="true">▶</span>
      {label}
    </a>
  );
}
