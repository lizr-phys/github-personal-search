CREATE TABLE "sponsored_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"repository_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"relevance_floor" real DEFAULT 0.65 NOT NULL,
	"quality_floor" real DEFAULT 0.75 NOT NULL,
	"safety_approved" boolean DEFAULT false NOT NULL,
	"commercial_score" real DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sponsored_exposures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"surface" text NOT NULL,
	"position" integer NOT NULL,
	"policy_version" text NOT NULL,
	"relevance_score" real NOT NULL,
	"quality_score" real NOT NULL,
	"clicked_at" timestamp with time zone,
	"blocked_at" timestamp with time zone,
	"exposed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sponsored_candidates" ADD CONSTRAINT "sponsored_candidates_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsored_exposures" ADD CONSTRAINT "sponsored_exposures_candidate_id_sponsored_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."sponsored_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsored_exposures" ADD CONSTRAINT "sponsored_exposures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sponsored_candidates_campaign_repo_unique" ON "sponsored_candidates" USING btree ("campaign_id","repository_id");--> statement-breakpoint
CREATE INDEX "sponsored_candidates_status_time_idx" ON "sponsored_candidates" USING btree ("status","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "sponsored_exposures_user_time_idx" ON "sponsored_exposures" USING btree ("user_id","exposed_at");--> statement-breakpoint
CREATE INDEX "sponsored_exposures_candidate_time_idx" ON "sponsored_exposures" USING btree ("candidate_id","exposed_at");