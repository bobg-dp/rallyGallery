CREATE TABLE "guests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
