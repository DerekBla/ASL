import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

function token(name: string): string | undefined {
  return new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css)?.[1]?.toUpperCase();
}

describe("race color tokens", () => {
  // Values fixed by CLAUDE.md Domain Rules. Swapped race colors are a recurring bug.
  it.each([
    ["color-race-terran-pale", "#EAF3FB"],
    ["color-race-terran-dark", "#3A6EA8"],
    ["color-race-zerg-pale", "#F0EAF9"],
    ["color-race-zerg-dark", "#6B4FA0"],
    ["color-race-protoss-pale", "#E6F4EC"],
    ["color-race-protoss-dark", "#3D7A52"],
  ])("%s is %s", (name, hex) => {
    expect(token(name)).toBe(hex);
  });

  it("defines each race color exactly once", () => {
    const pattern = /--(color-race-(?:terran|zerg|protoss)-(?:pale|dark)):/g;
    const names = [...css.matchAll(pattern)].map((m) => m[1]);
    expect(names).toHaveLength(6);
    expect(new Set(names).size).toBe(6);
  });
});
