import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataTable } from "@/components/DataTable";
import type { DataTableColumn, DataTableRow } from "@/components/DataTable";

const COLUMNS: DataTableColumn[] = [
  { key: "name", header: "Player" },
  { key: "elo", header: "ELO", align: "right", firstSort: "desc" },
  { key: "note", header: "Note", sortable: false },
];

function row(name: string, elo: number | null): DataTableRow {
  return { id: name, cells: { name, elo: elo ?? "–", note: "x" }, sort: { name, elo } };
}

const ROWS = [row("Flash", 2181), row("soma", 2126), row("Best", null), row("Rain", 1900)];

function names(): string[] {
  return within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("cell")[0]?.textContent ?? "");
}

describe("DataTable", () => {
  it("renders the caption, headers and rows in the given order", () => {
    render(<DataTable caption="Players" columns={COLUMNS} rows={ROWS} />);
    expect(screen.getByRole("table", { name: "Players" })).toBeInTheDocument();
    expect(names()).toEqual(["Flash", "soma", "Best", "Rain"]);
  });

  it("starts with the initial sort and marks it for screen readers", () => {
    render(
      <DataTable
        caption="Players"
        columns={COLUMNS}
        rows={ROWS}
        initialSort={{ key: "name", dir: "asc" }}
      />,
    );
    expect(names()).toEqual(["Best", "Flash", "Rain", "soma"]);
    expect(screen.getByRole("columnheader", { name: /Player/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("sorts by a column on click, first in its preferred direction, and keeps blanks last", () => {
    render(<DataTable caption="Players" columns={COLUMNS} rows={ROWS} />);
    fireEvent.click(screen.getByRole("button", { name: /ELO/ }));
    expect(names()).toEqual(["Flash", "soma", "Rain", "Best"]);
    fireEvent.click(screen.getByRole("button", { name: /ELO/ }));
    expect(names()).toEqual(["Rain", "soma", "Flash", "Best"]);
    expect(screen.getByRole("columnheader", { name: /ELO/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("does not offer sorting on unsortable columns", () => {
    render(<DataTable caption="Players" columns={COLUMNS} rows={ROWS} />);
    expect(screen.queryByRole("button", { name: /Note/ })).not.toBeInTheDocument();
  });
});
