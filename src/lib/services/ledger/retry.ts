/** Postgres error helpers (Docs/integration-specs/neon-drizzle.md: Error mapping). */

export function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (typeof current === "object" && "code" in current) {
      const code = (current as { code: unknown }).code;
      if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    }
    current = typeof current === "object" && "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

const RETRYABLE = new Set(["40001", "40P01"]); // serialization failure, deadlock

/**
 * Runs a transaction, retrying up to 3 more times on serialization failures and deadlocks,
 * with jitter. Safe because every write path is idempotent (ledger-writes.md).
 */
export async function withRetry<T>(run: () => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= attempts || !RETRYABLE.has(pgErrorCode(error) ?? "")) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * attempt + Math.random() * 40));
    }
  }
}
