import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { people } from "@/db/schema";
import { slugify, uniqueSlug } from "./slug";

export async function findOrCreatePerson(name: string) {
  const trimmed = name.trim();
  const base = slugify(trimmed);
  const existing = await getDb().query.people.findFirst({ where: eq(people.slug, base) });
  if (existing) return existing.id;
  const slug = await uniqueSlug(base, async (candidate) => {
    const row = await getDb().query.people.findFirst({ where: eq(people.slug, candidate) });
    return Boolean(row);
  });
  const [created] = await getDb().insert(people).values({ name: trimmed, slug }).returning();
  return created.id;
}

export async function slugTaken(table: "authors" | "events" | "series", slug: string, exceptId?: string) {
  const db = getDb();
  if (table === "authors") {
    const { authors } = await import("@/db/schema");
    const row = await db.query.authors.findFirst({ where: eq(authors.slug, slug) });
    return Boolean(row && row.id !== exceptId);
  }
  if (table === "events") {
    const { events } = await import("@/db/schema");
    const row = await db.query.events.findFirst({ where: eq(events.slug, slug) });
    return Boolean(row && row.id !== exceptId);
  }
  const { series } = await import("@/db/schema");
  const row = await db.query.series.findFirst({ where: eq(series.slug, slug) });
  return Boolean(row && row.id !== exceptId);
}

export async function eventSlugTaken(eventId: string, column: "stages" | "galleries", slug: string) {
  const db = getDb();
  if (column === "stages") {
    const { stages } = await import("@/db/schema");
    const row = await db.query.stages.findFirst({
      where: and(eq(stages.eventId, eventId), eq(stages.slug, slug)),
    });
    return Boolean(row);
  }
  const { galleries } = await import("@/db/schema");
  const row = await db.query.galleries.findFirst({
    where: and(eq(galleries.eventId, eventId), eq(galleries.slug, slug)),
  });
  return Boolean(row);
}
