import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "editor"]);
export const photoStatus = pgEnum("photo_status", ["draft", "published"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("editor"),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

export const series = pgTable("series", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  seriesId: uuid("series_id")
    .notNull()
    .references(() => series.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  position: integer("position").notNull().default(0),
  galleryMinPhotos: integer("gallery_min_photos").notNull().default(8),
  heroPhotoId: uuid("hero_photo_id").references((): AnyPgColumn => photos.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stages = pgTable(
  "stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    dayNumber: integer("day_number").notNull().default(1),
    position: integer("position").notNull().default(0),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
  },
  (table) => [uniqueIndex("stages_event_slug").on(table.eventId, table.slug)],
);

export const people = pgTable("people", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const competitions = pgTable(
  "competitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    position: integer("position").notNull().default(0),
  },
  (table) => [uniqueIndex("competitions_event_slug").on(table.eventId, table.slug)],
);

export const crewEntries = pgTable(
  "crew_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    competitionId: uuid("competition_id").references(() => competitions.id, { onDelete: "restrict" }),
    startNumber: text("start_number").notNull(),
    className: text("class_name").notNull(),
    car: text("car").notNull(),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    codriverId: uuid("codriver_id").references(() => people.id, { onDelete: "restrict" }),
  },
  (table) => [uniqueIndex("crew_event_number").on(table.eventId, sql`lower(${table.startNumber})`)],
);

export const authors = pgTable("authors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  websiteUrl: text("website_url"),
  websiteLabel: text("website_label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const galleries = pgTable(
  "galleries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => authors.id, { onDelete: "restrict" }),
    title: text("title"),
    slug: text("slug").notNull(),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("galleries_event_slug").on(table.eventId, table.slug)],
);

export const cars = pgTable(
  "cars",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("cars_name_lower_idx").on(sql`lower(${table.name})`)],
);

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    galleryId: uuid("gallery_id")
      .notNull()
      .references(() => galleries.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id").references(() => stages.id, { onDelete: "restrict" }),
    carId: uuid("car_id").references(() => cars.id, { onDelete: "set null" }),
    spectators: boolean("spectators").notNull().default(false),
    caption: text("caption"),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    status: photoStatus("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    originalKey: text("original_key").notNull(),
    thumbKey: text("thumb_key").notNull(),
    gridKey: text("grid_key").notNull(),
    viewKey: text("view_key").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    uploadedById: uuid("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("photos_gallery_idx").on(table.galleryId),
    index("photos_status_idx").on(table.status),
  ],
);

export const photoCrews = pgTable(
  "photo_crews",
  {
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    crewEntryId: uuid("crew_entry_id")
      .notNull()
      .references(() => crewEntries.id, { onDelete: "restrict" }),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.photoId, table.crewEntryId] }),
    index("photo_crews_crew_idx").on(table.crewEntryId),
  ],
);

export const guests = pgTable("guests", {
  id: uuid("id").primaryKey(),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const seriesRelations = relations(series, ({ many }) => ({
  events: many(events),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  series: one(series, { fields: [events.seriesId], references: [series.id] }),
  stages: many(stages),
  competitions: many(competitions),
  crews: many(crewEntries),
  galleries: many(galleries),
}));

export const competitionsRelations = relations(competitions, ({ one, many }) => ({
  event: one(events, { fields: [competitions.eventId], references: [events.id] }),
  crews: many(crewEntries),
}));

export const stagesRelations = relations(stages, ({ one }) => ({
  event: one(events, { fields: [stages.eventId], references: [events.id] }),
}));

export const crewEntriesRelations = relations(crewEntries, ({ one, many }) => ({
  event: one(events, { fields: [crewEntries.eventId], references: [events.id] }),
  competition: one(competitions, { fields: [crewEntries.competitionId], references: [competitions.id] }),
  driver: one(people, { fields: [crewEntries.driverId], references: [people.id], relationName: "driver" }),
  codriver: one(people, { fields: [crewEntries.codriverId], references: [people.id], relationName: "codriver" }),
  photos: many(photoCrews),
}));

export const peopleRelations = relations(people, ({ many }) => ({
  drives: many(crewEntries, { relationName: "driver" }),
  codrives: many(crewEntries, { relationName: "codriver" }),
}));

export const authorsRelations = relations(authors, ({ many }) => ({
  galleries: many(galleries),
}));

export const galleriesRelations = relations(galleries, ({ one, many }) => ({
  event: one(events, { fields: [galleries.eventId], references: [events.id] }),
  author: one(authors, { fields: [galleries.authorId], references: [authors.id] }),
  photos: many(photos),
}));

export const photosRelations = relations(photos, ({ one, many }) => ({
  gallery: one(galleries, { fields: [photos.galleryId], references: [galleries.id] }),
  stage: one(stages, { fields: [photos.stageId], references: [stages.id] }),
  car: one(cars, { fields: [photos.carId], references: [cars.id] }),
  crews: many(photoCrews),
}));

export const photoCrewsRelations = relations(photoCrews, ({ one }) => ({
  photo: one(photos, { fields: [photoCrews.photoId], references: [photos.id] }),
  crew: one(crewEntries, { fields: [photoCrews.crewEntryId], references: [crewEntries.id] }),
}));
