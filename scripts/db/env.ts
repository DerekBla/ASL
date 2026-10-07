import { existsSync, readFileSync } from "node:fs";

/** Loads .env.local into process.env for scripts (Next.js does this itself for the app). */
export function loadEnvLocal(path = ".env.local"): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match?.[1] || line.trimStart().startsWith("#")) continue;
    const value = (match[2] ?? "").replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}
