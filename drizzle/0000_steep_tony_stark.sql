CREATE TABLE "roasts" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_hash" text NOT NULL,
	"source" text NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"summary" jsonb,
	"roast" jsonb,
	"generator" text NOT NULL,
	"feedback" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "roasts_source_check" CHECK ("roasts"."source" in ('takeout', 'quick')),
	CONSTRAINT "roasts_visibility_check" CHECK ("roasts"."visibility" in ('private', 'public')),
	CONSTRAINT "roasts_generator_check" CHECK ("roasts"."generator" in ('gemini', 'gemini-lite', 'groq', 'template')),
	CONSTRAINT "roasts_feedback_check" CHECK ("roasts"."feedback" in (-1, 1)),
	CONSTRAINT "roasts_deleted_content_check" CHECK (("roasts"."deleted_at" is null) = ("roasts"."summary" is not null and "roasts"."roast" is not null))
);
