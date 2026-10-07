CREATE TYPE "public"."entry_reason" AS ENUM('signup_grant', 'periodic_grant', 'trade', 'payout', 'refund', 'subsidy', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."market_kind" AS ENUM('binary', 'multi');--> statement-breakpoint
CREATE TYPE "public"."market_status" AS ENUM('open', 'closed', 'resolved', 'voided');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text,
	"is_house" boolean DEFAULT false NOT NULL,
	"balance" numeric(18, 6) DEFAULT '0' NOT NULL,
	CONSTRAINT "accounts_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_or_house" CHECK (("accounts"."user_id" is null) = "accounts"."is_house"),
	CONSTRAINT "non_negative" CHECK ("accounts"."is_house" or "accounts"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" bigint NOT NULL,
	"amount" numeric(18, 6) NOT NULL,
	"reason" "entry_reason" NOT NULL,
	"market_id" bigint,
	"trade_id" bigint,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_outcomes" (
	"market_id" bigint NOT NULL,
	"idx" integer NOT NULL,
	"label" text NOT NULL,
	"player" text,
	"q" numeric(18, 6) NOT NULL,
	"q0" numeric(18, 6) NOT NULL,
	CONSTRAINT "market_outcomes_market_id_idx_pk" PRIMARY KEY("market_id","idx")
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"question" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"kind" "market_kind" NOT NULL,
	"b" numeric(18, 6) NOT NULL,
	"status" "market_status" DEFAULT 'open' NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"resolved_outcome" integer,
	"resolution_note" text,
	"season" integer,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "markets_slug_unique" UNIQUE("slug"),
	CONSTRAINT "positive_b" CHECK ("markets"."b" > 0)
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"user_id" text NOT NULL,
	"market_id" bigint NOT NULL,
	"outcome_idx" integer NOT NULL,
	"shares" numeric(18, 6) DEFAULT '0' NOT NULL,
	"cost_basis" numeric(18, 6) DEFAULT '0' NOT NULL,
	CONSTRAINT "positions_user_id_market_id_outcome_idx_pk" PRIMARY KEY("user_id","market_id","outcome_idx"),
	CONSTRAINT "no_naked_shorts" CHECK ("positions"."shares" >= 0)
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"market_id" bigint NOT NULL,
	"user_id" text NOT NULL,
	"outcome_idx" integer NOT NULL,
	"shares" numeric(18, 6) NOT NULL,
	"cost" numeric(18, 6) NOT NULL,
	"price_before" numeric(10, 8) NOT NULL,
	"price_after" numeric(10, 8) NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trades_user_idempotency" UNIQUE("user_id","idempotency_key"),
	CONSTRAINT "non_zero_shares" CHECK ("trades"."shares" <> 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_outcomes" ADD CONSTRAINT "market_outcomes_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_house" ON "accounts" USING btree ("is_house") WHERE "accounts"."is_house";--> statement-breakpoint
CREATE INDEX "ledger_entries_account_created" ON "ledger_entries" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "trades_market_created" ON "trades" USING btree ("market_id","created_at");