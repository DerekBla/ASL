CREATE TABLE "pickem_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"pickem_id" bigint NOT NULL,
	"user_id" text NOT NULL,
	"picks" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pickem_entries_one_per_user" UNIQUE("pickem_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "pickems" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"title" text NOT NULL,
	"locks_at" timestamp with time zone NOT NULL,
	"config" jsonb NOT NULL,
	"results" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"results_note" text,
	"results_updated_by" text,
	"results_updated_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pickems_season_unique" UNIQUE("season")
);
--> statement-breakpoint
ALTER TABLE "pickem_entries" ADD CONSTRAINT "pickem_entries_pickem_id_pickems_id_fk" FOREIGN KEY ("pickem_id") REFERENCES "public"."pickems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickem_entries" ADD CONSTRAINT "pickem_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickems" ADD CONSTRAINT "pickems_results_updated_by_users_id_fk" FOREIGN KEY ("results_updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickems" ADD CONSTRAINT "pickems_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;