CREATE TYPE "public"."draft_status" AS ENUM('lobby', 'drafting', 'drafted');--> statement-breakpoint
CREATE TABLE "draft_leagues" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"pickem_id" bigint NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"owner_id" text NOT NULL,
	"status" "draft_status" DEFAULT 'lobby' NOT NULL,
	"team_size" integer,
	"pool" jsonb NOT NULL,
	"order" jsonb,
	"turn_started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "draft_leagues_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "draft_members" (
	"league_id" bigint NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "draft_members_league_id_user_id_pk" PRIMARY KEY("league_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "draft_picks" (
	"league_id" bigint NOT NULL,
	"pick_no" integer NOT NULL,
	"user_id" text NOT NULL,
	"player" text NOT NULL,
	"auto" boolean DEFAULT false NOT NULL,
	"picked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "draft_picks_league_id_pick_no_pk" PRIMARY KEY("league_id","pick_no"),
	CONSTRAINT "draft_picks_player_once" UNIQUE("league_id","player")
);
--> statement-breakpoint
ALTER TABLE "pickems" ADD COLUMN "game_wins" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "draft_leagues" ADD CONSTRAINT "draft_leagues_pickem_id_pickems_id_fk" FOREIGN KEY ("pickem_id") REFERENCES "public"."pickems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_leagues" ADD CONSTRAINT "draft_leagues_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_members" ADD CONSTRAINT "draft_members_league_id_draft_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."draft_leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_members" ADD CONSTRAINT "draft_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_league_id_draft_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."draft_leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;