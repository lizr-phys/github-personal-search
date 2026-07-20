CREATE EXTENSION IF NOT EXISTS "vector";--> statement-breakpoint
CREATE TYPE "public"."data_source" AS ENUM('demo', 'github', 'user');--> statement-breakpoint
CREATE TYPE "public"."interaction_type" AS ENUM('interested', 'favorite', 'open_github', 'open_demo', 'learn', 'ran', 'reproduced', 'used', 'not_interested', 'seen', 'too_complex', 'language_mismatch', 'unmaintained', 'block_similar', 'dwell', 'expand');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'dead');--> statement-breakpoint
CREATE TYPE "public"."library_status" AS ENUM('read_later', 'learning', 'ran', 'reproduced', 'used', 'paused', 'outdated');--> statement-breakpoint
CREATE TYPE "public"."subscription_frequency" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TABLE "algorithm_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"kind" text NOT NULL,
	"config" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"encrypted_access_token" text,
	"token_key_version" integer DEFAULT 1 NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"imported_stars_count" integer DEFAULT 0 NOT NULL,
	"last_synced_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "collection_repositories" (
	"collection_id" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	"status" "library_status" DEFAULT 'read_later' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "collection_repositories_collection_id_repository_id_pk" PRIMARY KEY("collection_id","repository_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subscription_id" uuid,
	"provider" text NOT NULL,
	"provider_message_id" text,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"repository_ids" uuid[] NOT NULL,
	"status" text NOT NULL,
	"sent_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "exposures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	"surface" text NOT NULL,
	"feed_batch_id" uuid,
	"search_session_id" uuid,
	"position" integer NOT NULL,
	"retrieval_sources" text[] NOT NULL,
	"algorithm_version" text NOT NULL,
	"model_features" jsonb NOT NULL,
	"exposed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"update_kind" text DEFAULT 'normal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "feed_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"batch_number" integer NOT NULL,
	"session_id" text NOT NULL,
	"repository_ids" uuid[] NOT NULL,
	"rerank_context" jsonb NOT NULL,
	"algorithm_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "feed_queue_items" (
	"queue_id" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	"initial_position" integer NOT NULL,
	"candidate_type" text NOT NULL,
	"score" real NOT NULL,
	"retrieval_sources" text[] NOT NULL,
	"features" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "feed_queue_items_queue_id_repository_id_pk" PRIMARY KEY("queue_id","repository_id")
);
--> statement-breakpoint
CREATE TABLE "feed_queues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"queue_date" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'warm' NOT NULL,
	"algorithm_version_id" uuid,
	"candidate_count" integer NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	"exposure_id" uuid,
	"type" "interaction_type" NOT NULL,
	"reason" text,
	"weight" real NOT NULL,
	"surface" text NOT NULL,
	"session_id" text NOT NULL,
	"algorithm_version" text NOT NULL,
	"undone_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "learning_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	"status" "library_status" NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"note" text,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_id" bigint,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"url" text NOT NULL,
	"homepage_url" text,
	"demo_url" text,
	"description" text,
	"chinese_title" text NOT NULL,
	"summary" text NOT NULL,
	"primary_language" text,
	"languages" text[] DEFAULT '{}' NOT NULL,
	"topics" text[] DEFAULT '{}' NOT NULL,
	"domains" text[] DEFAULT '{}' NOT NULL,
	"project_type" text NOT NULL,
	"deployment" text[] DEFAULT '{}' NOT NULL,
	"difficulty" text DEFAULT 'medium' NOT NULL,
	"maturity" text DEFAULT 'stable' NOT NULL,
	"license_spdx" text,
	"stars" integer DEFAULT 0 NOT NULL,
	"forks" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"mirror" boolean DEFAULT false NOT NULL,
	"fork" boolean DEFAULT false NOT NULL,
	"has_readme" boolean DEFAULT true NOT NULL,
	"quality_score" real DEFAULT 0 NOT NULL,
	"data_source" "data_source" DEFAULT 'demo' NOT NULL,
	"data_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pushed_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"repo_created_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "repository_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"document_type" text DEFAULT 'semantic' NOT NULL,
	"content" text NOT NULL,
	"readme_summary" text,
	"core_features" text[] DEFAULT '{}' NOT NULL,
	"target_users" text[] DEFAULT '{}' NOT NULL,
	"technologies" text[] DEFAULT '{}' NOT NULL,
	"dependencies" text[] DEFAULT '{}' NOT NULL,
	"source_url" text,
	"etag" text,
	"parser_version" text NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "repository_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"document_id" uuid,
	"model" text NOT NULL,
	"dimensions" integer NOT NULL,
	"embedding" vector(384) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "repository_relations" (
	"from_repository_id" uuid NOT NULL,
	"to_repository_id" uuid NOT NULL,
	"relation_type" text NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"evidence" text,
	"source" "data_source" DEFAULT 'github' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "repository_relations_from_repository_id_to_repository_id_relation_type_pk" PRIMARY KEY("from_repository_id","to_repository_id","relation_type")
);
--> statement-breakpoint
CREATE TABLE "repository_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"stars" integer NOT NULL,
	"forks" integer NOT NULL,
	"commits" integer DEFAULT 0 NOT NULL,
	"open_issues" integer DEFAULT 0 NOT NULL,
	"open_pull_requests" integer DEFAULT 0 NOT NULL,
	"contributors" integer DEFAULT 0 NOT NULL,
	"release_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "search_results" (
	"search_session_id" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"score" real NOT NULL,
	"cluster" text NOT NULL,
	"retrieval_sources" text[] NOT NULL,
	"features" jsonb NOT NULL,
	"explanation" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "search_results_search_session_id_repository_id_pk" PRIMARY KEY("search_session_id","repository_id")
);
--> statement-breakpoint
CREATE TABLE "search_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"raw_query" text NOT NULL,
	"normalized_query" text NOT NULL,
	"intent" jsonb NOT NULL,
	"mode" text DEFAULT 'comprehensive' NOT NULL,
	"affects_profile" boolean DEFAULT true NOT NULL,
	"algorithm_version_id" uuid,
	"parser_version" text NOT NULL,
	"latency_ms" integer,
	"result_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "subscription_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	"category" text NOT NULL,
	"score" real NOT NULL,
	"matched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"major_update_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"raw_query" text NOT NULL,
	"intent" jsonb NOT NULL,
	"query_vector" real[] DEFAULT '{}' NOT NULL,
	"required_constraints" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"negative_constraints" text[] DEFAULT '{}' NOT NULL,
	"time_range" text DEFAULT 'any' NOT NULL,
	"min_relevance" real DEFAULT 0.55 NOT NULL,
	"min_quality" real DEFAULT 0.55 NOT NULL,
	"heat_threshold" real DEFAULT 0 NOT NULL,
	"frequency" "subscription_frequency" DEFAULT 'weekly' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_matched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_interest_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"scope" text NOT NULL,
	"weight" real NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"expires_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"long_term" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"short_term" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"capability" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"negative_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"exposure_memory" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"paused_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_login" text,
	"display_name" text NOT NULL,
	"email" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"search_affects_profile" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_repositories" ADD CONSTRAINT "collection_repositories_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_repositories" ADD CONSTRAINT "collection_repositories_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exposures" ADD CONSTRAINT "exposures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exposures" ADD CONSTRAINT "exposures_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exposures" ADD CONSTRAINT "exposures_feed_batch_id_feed_batches_id_fk" FOREIGN KEY ("feed_batch_id") REFERENCES "public"."feed_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exposures" ADD CONSTRAINT "exposures_search_session_id_search_sessions_id_fk" FOREIGN KEY ("search_session_id") REFERENCES "public"."search_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_batches" ADD CONSTRAINT "feed_batches_queue_id_feed_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."feed_queues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_batches" ADD CONSTRAINT "feed_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_batches" ADD CONSTRAINT "feed_batches_algorithm_version_id_algorithm_versions_id_fk" FOREIGN KEY ("algorithm_version_id") REFERENCES "public"."algorithm_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_queue_items" ADD CONSTRAINT "feed_queue_items_queue_id_feed_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."feed_queues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_queue_items" ADD CONSTRAINT "feed_queue_items_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_queues" ADD CONSTRAINT "feed_queues_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_queues" ADD CONSTRAINT "feed_queues_algorithm_version_id_algorithm_versions_id_fk" FOREIGN KEY ("algorithm_version_id") REFERENCES "public"."algorithm_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_exposure_id_exposures_id_fk" FOREIGN KEY ("exposure_id") REFERENCES "public"."exposures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_logs" ADD CONSTRAINT "learning_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_logs" ADD CONSTRAINT "learning_logs_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_documents" ADD CONSTRAINT "repository_documents_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_embeddings" ADD CONSTRAINT "repository_embeddings_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_embeddings" ADD CONSTRAINT "repository_embeddings_document_id_repository_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."repository_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_relations" ADD CONSTRAINT "repository_relations_from_repository_id_repositories_id_fk" FOREIGN KEY ("from_repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_relations" ADD CONSTRAINT "repository_relations_to_repository_id_repositories_id_fk" FOREIGN KEY ("to_repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_snapshots" ADD CONSTRAINT "repository_snapshots_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_results" ADD CONSTRAINT "search_results_search_session_id_search_sessions_id_fk" FOREIGN KEY ("search_session_id") REFERENCES "public"."search_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_results" ADD CONSTRAINT "search_results_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_sessions" ADD CONSTRAINT "search_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_sessions" ADD CONSTRAINT "search_sessions_algorithm_version_id_algorithm_versions_id_fk" FOREIGN KEY ("algorithm_version_id") REFERENCES "public"."algorithm_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_matches" ADD CONSTRAINT "subscription_matches_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_matches" ADD CONSTRAINT "subscription_matches_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interest_items" ADD CONSTRAINT "user_interest_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "algorithm_versions_name_version_unique" ON "algorithm_versions" USING btree ("name","version");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_accounts_provider_unique" ON "auth_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "auth_accounts_user_idx" ON "auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "collection_repositories_repo_idx" ON "collection_repositories" USING btree ("repository_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_user_name_unique" ON "collections" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "email_deliveries_user_time_idx" ON "email_deliveries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "exposures_user_repo_time_idx" ON "exposures" USING btree ("user_id","repository_id","exposed_at");--> statement-breakpoint
CREATE INDEX "exposures_batch_idx" ON "exposures" USING btree ("feed_batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feed_batches_queue_number_unique" ON "feed_batches" USING btree ("queue_id","batch_number");--> statement-breakpoint
CREATE INDEX "feed_batches_user_time_idx" ON "feed_batches" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "feed_queues_user_date_unique" ON "feed_queues" USING btree ("user_id","queue_date");--> statement-breakpoint
CREATE INDEX "interactions_user_time_idx" ON "interactions" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "interactions_repo_type_idx" ON "interactions" USING btree ("repository_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "job_runs_idempotency_unique" ON "job_runs" USING btree ("job_type","idempotency_key");--> statement-breakpoint
CREATE INDEX "job_runs_status_created_idx" ON "job_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "learning_logs_user_time_idx" ON "learning_logs" USING btree ("user_id","logged_at");--> statement-breakpoint
CREATE INDEX "notes_user_repo_idx" ON "notes" USING btree ("user_id","repository_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_full_name_unique" ON "repositories" USING btree ("full_name");--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_github_id_unique" ON "repositories" USING btree ("github_id");--> statement-breakpoint
CREATE INDEX "repositories_language_idx" ON "repositories" USING btree ("primary_language");--> statement-breakpoint
CREATE INDEX "repositories_type_idx" ON "repositories" USING btree ("project_type");--> statement-breakpoint
CREATE INDEX "repositories_updated_idx" ON "repositories" USING btree ("data_updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "repository_documents_repo_type_unique" ON "repository_documents" USING btree ("repository_id","document_type");--> statement-breakpoint
CREATE INDEX "repository_documents_repo_idx" ON "repository_documents" USING btree ("repository_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repository_embeddings_repo_model_unique" ON "repository_embeddings" USING btree ("repository_id","model");--> statement-breakpoint
CREATE INDEX "repository_embeddings_hnsw_idx" ON "repository_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "repository_relations_to_idx" ON "repository_relations" USING btree ("to_repository_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repository_snapshots_repo_time_unique" ON "repository_snapshots" USING btree ("repository_id","captured_at");--> statement-breakpoint
CREATE INDEX "repository_snapshots_time_idx" ON "repository_snapshots" USING btree ("captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "search_results_session_position_unique" ON "search_results" USING btree ("search_session_id","position");--> statement-breakpoint
CREATE INDEX "search_sessions_user_time_idx" ON "search_sessions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_matches_dedupe_unique" ON "subscription_matches" USING btree ("subscription_id","repository_id","major_update_key");--> statement-breakpoint
CREATE INDEX "subscription_matches_time_idx" ON "subscription_matches" USING btree ("matched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_user_name_unique" ON "subscriptions" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "user_interest_items_unique" ON "user_interest_items" USING btree ("user_id","kind","value","scope");--> statement-breakpoint
CREATE INDEX "user_interest_items_user_idx" ON "user_interest_items" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_github_login_unique" ON "users" USING btree ("github_login");
