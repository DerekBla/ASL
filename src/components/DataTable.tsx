"use client";

import { useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";

export type DataTableColumn = {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  /** Columns are sortable unless this is false. */
  sortable?: boolean;
  /** Direction a first click sorts in. Numbers usually want "desc". */
  firstSort?: "asc" | "desc";
};

export type DataTableRow = {
  id: string;
  /** Rendered cell content, keyed by column key. Rendered on the server. */
  cells: Record<string, ReactNode>;
  /** Plain values to sort by, keyed by column key. null sorts last. */
  sort: Record<string, string | number | null>;
};

type Props = {
  caption: string;
  columns: readonly DataTableColumn[];
  rows: readonly DataTableRow[];
  initialSort?: { key: string; dir: "asc" | "desc" };
  /** Show the caption visually (default) or only to screen readers. */
  captionVisible?: boolean;
};

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;

function compare(a: string | number | null, b: string | number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en", { sensitivity: "base", numeric: true });
}

/**
 * Stats table with a sticky header. Cells are rendered on the server and passed in; sorting
 * is the only thing that runs in the browser.
 */
export function DataTable({
  caption,
  columns,
  rows,
  initialSort,
  captionVisible = true,
}: Props): ReactElement {
  const [sort, setSort] = useState(initialSort);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((x, y) => {
      const vx = x.sort[sort.key] ?? null;
      const vy = y.sort[sort.key] ?? null;
      if (vx === null || vy === null) return compare(vx, vy); // nulls last in both directions
      return sign * compare(vx, vy) || x.id.localeCompare(y.id);
    });
  }, [rows, sort]);

  function toggle(column: DataTableColumn): void {
    setSort((current) =>
      current?.key === column.key
        ? { key: column.key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key: column.key, dir: column.firstSort ?? "asc" },
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full border-collapse text-data">
        <caption
          className={
            captionVisible ? "px-4 pt-3 pb-1 text-left text-caption text-ink-muted" : "sr-only"
          }
        >
          {caption}
        </caption>
        <thead className="sticky top-0 bg-card">
          <tr>
            {columns.map((column) => {
              const align = ALIGN[column.align ?? "left"];
              const active = sort?.key === column.key;
              const ariaSort = active
                ? sort.dir === "asc"
                  ? "ascending"
                  : "descending"
                : column.sortable === false
                  ? undefined
                  : "none";
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={`border-b border-line/70 px-4 py-2.5 text-caption font-medium whitespace-nowrap text-ink-muted ${align}`}
                >
                  {column.sortable === false ? (
                    column.header
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggle(column)}
                      className="inline-flex items-center gap-1 font-medium hover:text-ink"
                    >
                      {column.header}
                      <span aria-hidden="true" className="text-ink-muted/60">
                        {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.id}
              className="border-b border-line/50 transition-colors last:border-b-0 hover:bg-surface-muted/60"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-4 py-2.5 tabular-nums ${ALIGN[column.align ?? "left"]}`}
                >
                  {row.cells[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
