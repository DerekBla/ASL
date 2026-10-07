import { sql } from "drizzle-orm";

import type { DbOrTx } from "@/lib/db/types";

import { toNumber } from "./numeric";

const TOLERANCE = 1e-6;

type Row = Record<string, unknown>;

async function rows(db: DbOrTx, query: ReturnType<typeof sql>): Promise<Row[]> {
  const result: unknown = await db.execute(query);
  if (Array.isArray(result)) return result as Row[];
  return ((result as { rows?: Row[] }).rows ?? []) as Row[];
}

/**
 * Checks the ledger invariants (Docs/foundation-specs/ledger.md) and returns every violation.
 * An empty list means the books balance. Used by tests and by the ledger auditor.
 */
export async function checkLedgerInvariants(db: DbOrTx): Promise<string[]> {
  const problems: string[] = [];

  // 1. Each balance equals the sum of its entries.
  for (const r of await rows(
    db,
    sql`select a.id, a.balance, coalesce(sum(e.amount), 0) as total
        from accounts a left join ledger_entries e on e.account_id = a.id
        group by a.id, a.balance having a.balance <> coalesce(sum(e.amount), 0)`,
  )) {
    problems.push(
      `account ${String(r.id)}: balance ${String(r.balance)} but entries sum to ${String(r.total)}`,
    );
  }

  // 2 and 3. No negative user balances, no negative positions (also enforced by CHECKs).
  for (const r of await rows(
    db,
    sql`select id, balance from accounts where not is_house and balance < 0`,
  )) {
    problems.push(`account ${String(r.id)} is negative: ${String(r.balance)}`);
  }
  for (const r of await rows(
    db,
    sql`select user_id, market_id, outcome_idx, shares from positions where shares < 0`,
  )) {
    problems.push(
      `position ${String(r.user_id)}/${String(r.market_id)}/${String(r.outcome_idx)} is short: ${String(r.shares)}`,
    );
  }

  // Conservation: every credit is in a balance or held by a market that hasn't settled yet.
  const [total] = await rows(
    db,
    sql`select (select coalesce(sum(balance), 0) from accounts) as balances,
               (select coalesce(sum(t.cost), 0) from trades t join markets m on m.id = t.market_id
                 where m.status in ('open', 'closed')) as held`,
  );
  const drift = toNumber(String(total?.balances ?? 0)) + toNumber(String(total?.held ?? 0));
  if (Math.abs(drift) > TOLERANCE)
    problems.push(`credits not conserved: off by ${drift.toFixed(6)}`);

  // q moves only by trades: q = q0 + sum(shares) for every outcome.
  for (const r of await rows(
    db,
    sql`select o.market_id, o.idx, o.q, o.q0 + coalesce(sum(t.shares), 0) as expected
        from market_outcomes o
        left join trades t on t.market_id = o.market_id and t.outcome_idx = o.idx
        group by o.market_id, o.idx, o.q, o.q0
        having o.q <> o.q0 + coalesce(sum(t.shares), 0)`,
  )) {
    problems.push(
      `market ${String(r.market_id)} outcome ${String(r.idx)}: q ${String(r.q)} but trades imply ${String(r.expected)}`,
    );
  }

  return problems;
}
