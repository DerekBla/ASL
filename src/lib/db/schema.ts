/**
 * Database schema. Mirrors Docs/foundation-specs/ledger.md; that file is the reference.
 *
 * Money and shares are numeric(18,6) and come back from Drizzle as strings. Only
 * src/lib/services/ledger converts them (conventions: Money and Numbers).
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const marketStatus = pgEnum("market_status", ["open", "closed", "resolved", "voided"]);
export const marketKind = pgEnum("market_kind", ["binary", "multi"]);
export const entryReason = pgEnum("entry_reason", [
  "signup_grant",
  "periodic_grant",
  "trade",
  "payout",
  "refund",
  "subsidy",
  "adjustment",
]);

const money = (name: string) => numeric(name, { precision: 18, scale: 6 });
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user id
  displayName: text("display_name").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: created(),
});

export const accounts = pgTable(
  "accounts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: text("user_id")
      .unique()
      .references(() => users.id), // null only for the single house account
    isHouse: boolean("is_house").notNull().default(false),
    balance: money("balance").notNull().default("0"),
  },
  (t) => [
    check("user_or_house", sql`(${t.userId} is null) = ${t.isHouse}`),
    check("non_negative", sql`${t.isHouse} or ${t.balance} >= 0`),
    uniqueIndex("one_house")
      .on(t.isHouse)
      .where(sql`${t.isHouse}`),
  ],
);

export const markets = pgTable(
  "markets",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    slug: text("slug").notNull().unique(),
    question: text("question").notNull(),
    description: text("description").notNull().default(""),
    kind: marketKind("kind").notNull(),
    b: money("b").notNull(),
    status: marketStatus("status").notNull().default("open"),
    closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
    resolvedOutcome: integer("resolved_outcome"),
    resolutionNote: text("resolution_note"),
    season: integer("season"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: created(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [check("positive_b", sql`${t.b} > 0`)],
);

export const marketOutcomes = pgTable(
  "market_outcomes",
  {
    marketId: bigint("market_id", { mode: "number" })
      .notNull()
      .references(() => markets.id),
    idx: integer("idx").notNull(),
    label: text("label").notNull(),
    player: text("player"), // canonical player name when the outcome is a player
    q: money("q").notNull(), // LMSR quantity
    q0: money("q0").notNull(), // opening quantity, so audits can check q = q0 + sum(trade shares)
  },
  (t) => [primaryKey({ columns: [t.marketId, t.idx] })],
);

export const trades = pgTable(
  "trades",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    marketId: bigint("market_id", { mode: "number" })
      .notNull()
      .references(() => markets.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    outcomeIdx: integer("outcome_idx").notNull(),
    shares: money("shares").notNull(), // + buy, - sell
    cost: money("cost").notNull(), // + paid, - received
    priceBefore: numeric("price_before", { precision: 10, scale: 8 }).notNull(),
    priceAfter: numeric("price_after", { precision: 10, scale: 8 }).notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: created(),
  },
  (t) => [
    check("non_zero_shares", sql`${t.shares} <> 0`),
    unique("trades_user_idempotency").on(t.userId, t.idempotencyKey),
    index("trades_market_created").on(t.marketId, t.createdAt),
  ],
);

export const positions = pgTable(
  "positions",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    marketId: bigint("market_id", { mode: "number" })
      .notNull()
      .references(() => markets.id),
    outcomeIdx: integer("outcome_idx").notNull(),
    shares: money("shares").notNull().default("0"),
    costBasis: money("cost_basis").notNull().default("0"), // net credits spent, for refunds on void
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.marketId, t.outcomeIdx] }),
    check("no_naked_shorts", sql`${t.shares} >= 0`),
  ],
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    accountId: bigint("account_id", { mode: "number" })
      .notNull()
      .references(() => accounts.id),
    amount: money("amount").notNull(), // + credit, - debit
    reason: entryReason("reason").notNull(),
    marketId: bigint("market_id", { mode: "number" }).references(() => markets.id),
    tradeId: bigint("trade_id", { mode: "number" }).references(() => trades.id),
    note: text("note"),
    createdAt: created(),
  },
  (t) => [index("ledger_entries_account_created").on(t.accountId, t.createdAt)],
);
