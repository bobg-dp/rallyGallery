DROP INDEX "crew_event_number";--> statement-breakpoint
ALTER TABLE "crew_entries" ALTER COLUMN "start_number" SET DATA TYPE text;--> statement-breakpoint
CREATE UNIQUE INDEX "crew_event_number" ON "crew_entries" USING btree ("event_id",lower("start_number"));