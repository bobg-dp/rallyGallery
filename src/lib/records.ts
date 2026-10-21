import { and, asc, eq, ilike, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { cars, crewEntries, people } from "@/db/schema";
import { slugify, uniqueSlug } from "./slug";

export function normalizeCarName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export async function findOrCreateCar(raw: string) {
  const name = normalizeCarName(raw);
  const db = getDb();
  const existing = await db
    .select({ id: cars.id })
    .from(cars)
    .where(sql`lower(${cars.name}) = ${name.toLowerCase()}`)
    .limit(1);
  if (existing[0]) return existing[0].id;
  const slug = await uniqueSlug(slugify(name), async (candidate) => {
    const row = await db.select({ id: cars.id }).from(cars).where(eq(cars.slug, candidate)).limit(1);
    return Boolean(row[0]);
  });
  try {
    const [created] = await db.insert(cars).values({ name, slug }).returning({ id: cars.id });
    return created.id;
  } catch {
    const again = await db
      .select({ id: cars.id })
      .from(cars)
      .where(sql`lower(${cars.name}) = ${name.toLowerCase()}`)
      .limit(1);
    if (again[0]) return again[0].id;
    throw new Error("Nie udało się zapisać auta.");
  }
}

export async function searchCars(raw: string) {
  const query = normalizeCarName(raw);
  if (query.length < 1) return [];
  const phrase = query.includes(",");
  const like = `%${query.replace(/[%_]/g, "")}%`;
  const singleName = sql`position(',' in ${cars.name}) = 0`;
  const singleCrewCar = sql`position(',' in ${crewEntries.car}) = 0`;
  const catalogMatch = phrase ? sql`lower(${cars.name}) = lower(${query})` : and(ilike(cars.name, like), singleName);
  const declaredMatch = phrase ? sql`lower(${crewEntries.car}) = lower(${query})` : and(ilike(crewEntries.car, like), singleCrewCar);
  const db = getDb();
  const [catalog, declared] = await Promise.all([
    db.select({ name: cars.name }).from(cars).where(catalogMatch).orderBy(asc(cars.name)).limit(8),
    db.selectDistinct({ name: crewEntries.car }).from(crewEntries).where(declaredMatch).orderBy(asc(crewEntries.car)).limit(8),
  ]);
  const seen = new Set<string>();
  const names: string[] = [];
  for (const name of [...catalog, ...declared].map((row) => row.name).sort((a, b) => a.localeCompare(b, "pl"))) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length === 8) break;
  }
  return names;
}

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
