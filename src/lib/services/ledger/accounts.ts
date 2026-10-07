import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { SIGNUP_GRANT_CREDITS } from "@/lib/config/site";
import { accounts, ledgerEntries, users } from "@/lib/db/schema";
import type { Db, DbOrTx, Tx } from "@/lib/db/types";
import { accountId, userId as toUserId } from "@/lib/types/ids";
import type { AccountId, UserId } from "@/lib/types/ids";
import { err, ok } from "@/lib/types/result";
import type { LedgerError, Result } from "@/lib/types/result";

import { toNumber, toNumeric } from "./numeric";
import { withRetry } from "./retry";

export type GrantReason = "signup_grant" | "periodic_grant" | "adjustment";

/** The single house account that funds grants and market subsidies. Created on first use. */
export async function ensureHouseAccount(db: DbOrTx): Promise<AccountId> {
  await db.insert(accounts).values({ isHouse: true }).onConflictDoNothing();
  const [house] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.isHouse, true));
  if (!house) throw new Error("house account missing after insert");
  return accountId(house.id);
}

/** Locks account rows in ascending id order (the ledger's lock order). */
export async function lockAccounts(tx: Tx, ids: readonly number[]): Promise<void> {
  if (ids.length === 0) return;
  await tx
    .select({ id: accounts.id })
    .from(accounts)
    .where(inArray(accounts.id, [...ids]))
    .orderBy(asc(accounts.id))
    .for("update");
}

/** Adds an entry and moves the balance by the same amount. Caller holds the account lock. */
export async function post(
  tx: Tx,
  entry: {
    accountId: number;
    amount: number;
    reason: (typeof ledgerEntries.$inferInsert)["reason"];
    marketId?: number | undefined;
    tradeId?: number | undefined;
    note?: string | undefined;
  },
): Promise<number> {
  const amount = toNumeric(entry.amount);
  await tx.insert(ledgerEntries).values({
    accountId: entry.accountId,
    amount,
    reason: entry.reason,
    marketId: entry.marketId ?? null,
    tradeId: entry.tradeId ?? null,
    note: entry.note ?? null,
  });
  const [updated] = await tx
    .update(accounts)
    .set({ balance: sql`${accounts.balance} + ${amount}::numeric` })
    .where(eq(accounts.id, entry.accountId))
    .returning({ balance: accounts.balance });
  if (!updated) throw new Error(`account ${entry.accountId} vanished mid-transaction`);
  return toNumber(updated.balance);
}

async function grantInTx(
  tx: Tx,
  input: { accountId: number; amount: number; reason: GrantReason; note?: string | undefined },
): Promise<number> {
  const house = await ensureHouseAccount(tx);
  await lockAccounts(tx, [house, input.accountId]);
  await post(tx, {
    accountId: house,
    amount: -input.amount,
    reason: input.reason,
    note: input.note,
  });
  return post(tx, {
    accountId: input.accountId,
    amount: input.amount,
    reason: input.reason,
    note: input.note,
  });
}

/** Moves credits from the house to a user, so conservation holds. */
export async function grantCredits(
  db: Db,
  input: { userId: UserId; amount: number; reason: GrantReason; note?: string },
): Promise<Result<{ balance: number }, LedgerError>> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return err({ code: "INVALID_TRADE" });
  return withRetry(() =>
    db.transaction(async (tx) => {
      const [account] = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.userId, input.userId));
      if (!account) return err({ code: "NOT_FOUND" as const });
      const balance = await grantInTx(tx, {
        accountId: account.id,
        amount: input.amount,
        reason: input.reason,
        note: input.note,
      });
      return ok({ balance });
    }),
  );
}

export type ProvisionedUser = {
  userId: UserId;
  accountId: AccountId;
  created: boolean;
  isAdmin: boolean;
};

/**
 * Creates the user, their account, and the 100-mineral signup grant, once. Safe to call on
 * every authenticated request: a second call (or a concurrent one) changes nothing.
 */
export async function ensureUser(
  db: Db,
  input: { userId: UserId; displayName: string },
): Promise<ProvisionedUser> {
  return withRetry(() =>
    db.transaction(async (tx) => {
      const inserted = await tx
        .insert(users)
        .values({ id: input.userId, displayName: input.displayName.slice(0, 64) || "Player" })
        .onConflictDoNothing()
        .returning({ id: users.id });
      const [user] = await tx
        .select({ id: users.id, isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, input.userId));
      if (!user) throw new Error("user missing after insert");
      if (inserted.length === 0) {
        const [account] = await tx
          .select({ id: accounts.id })
          .from(accounts)
          .where(eq(accounts.userId, input.userId));
        if (!account) throw new Error(`user ${input.userId} has no account`);
        return {
          userId: toUserId(user.id),
          accountId: accountId(account.id),
          created: false,
          isAdmin: user.isAdmin,
        };
      }
      const [account] = await tx
        .insert(accounts)
        .values({ userId: input.userId, isHouse: false })
        .returning({ id: accounts.id });
      if (!account) throw new Error("account insert returned nothing");
      await grantInTx(tx, {
        accountId: account.id,
        amount: SIGNUP_GRANT_CREDITS,
        reason: "signup_grant",
      });
      return {
        userId: toUserId(user.id),
        accountId: accountId(account.id),
        created: true,
        isAdmin: user.isAdmin,
      };
    }),
  );
}

/** A user's balance, or undefined if they have no account yet. */
export async function getBalance(db: DbOrTx, user: UserId): Promise<number | undefined> {
  const [row] = await db
    .select({ balance: accounts.balance })
    .from(accounts)
    .where(and(eq(accounts.userId, user), eq(accounts.isHouse, false)));
  return row ? toNumber(row.balance) : undefined;
}
