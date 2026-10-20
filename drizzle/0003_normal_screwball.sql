CREATE TABLE "cars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cars_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "car_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "cars_name_lower_idx" ON "cars" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE set null ON UPDATE no action;