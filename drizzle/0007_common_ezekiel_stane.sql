CREATE TABLE "photo_crews" (
	"photo_id" uuid NOT NULL,
	"crew_entry_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "photo_crews_photo_id_crew_entry_id_pk" PRIMARY KEY("photo_id","crew_entry_id")
);
--> statement-breakpoint
ALTER TABLE "photos" DROP CONSTRAINT "photos_crew_entry_id_crew_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "photo_crews" ADD CONSTRAINT "photo_crews_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_crews" ADD CONSTRAINT "photo_crews_crew_entry_id_crew_entries_id_fk" FOREIGN KEY ("crew_entry_id") REFERENCES "public"."crew_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photo_crews_crew_idx" ON "photo_crews" USING btree ("crew_entry_id");--> statement-breakpoint
INSERT INTO "photo_crews" ("photo_id", "crew_entry_id", "position")
SELECT "id", "crew_entry_id", 0 FROM "photos" WHERE "crew_entry_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" DROP COLUMN "crew_entry_id";