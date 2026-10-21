import { asc, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { authors, cars, competitions, crewEntries, events, galleries, people, photoCrews, photos, stages } from "@/db/schema";
import { derivativeUrl } from "./storage";
import { startNumberOrder } from "./start-number";
import { dateToWarsawInput } from "./time";

const codrivers = alias(people, "codrivers");

export async function listStudioGalleries() {
  return getDb()
    .select({
      id: galleries.id,
      title: galleries.title,
      slug: galleries.slug,
      createdAt: galleries.createdAt,
      eventName: events.name,
      eventSlug: events.slug,
      authorName: authors.name,
      drafts: sql<number>`count(${photos.id}) filter (where ${photos.status} = 'draft')`.mapWith(Number),
      published: sql<number>`count(${photos.id}) filter (where ${photos.status} = 'published')`.mapWith(Number),
    })
    .from(galleries)
    .innerJoin(events, eq(galleries.eventId, events.id))
    .innerJoin(authors, eq(galleries.authorId, authors.id))
    .leftJoin(photos, eq(photos.galleryId, galleries.id))
    .groupBy(galleries.id, events.id, authors.id)
    .orderBy(desc(galleries.createdAt));
}

export async function listEventOptions() {
  return getDb()
    .select({ id: events.id, name: events.name })
    .from(events)
    .orderBy(desc(events.startsOn));
}

export async function listAuthors() {
  return getDb().select().from(authors).orderBy(asc(authors.name));
}

export async function getDesk(galleryId: string) {
  const gallery = await getDb().query.galleries.findFirst({
    where: eq(galleries.id, galleryId),
    with: { author: true, event: true },
  });
  if (!gallery) return null;

  const [stageRows, crewRows, competitionRows, authorRows, photoRows, linkRows] = await Promise.all([
    getDb().select().from(stages).where(eq(stages.eventId, gallery.eventId)).orderBy(asc(stages.position)),
    getDb()
      .select({
        id: crewEntries.id,
        startNumber: crewEntries.startNumber,
        className: crewEntries.className,
        car: crewEntries.car,
        driverName: people.name,
        codriverName: codrivers.name,
        competitionName: competitions.name,
      })
      .from(crewEntries)
      .innerJoin(people, eq(crewEntries.driverId, people.id))
      .leftJoin(codrivers, eq(crewEntries.codriverId, codrivers.id))
      .leftJoin(competitions, eq(crewEntries.competitionId, competitions.id))
      .where(eq(crewEntries.eventId, gallery.eventId))
      .orderBy(...startNumberOrder(crewEntries.startNumber)),
    getDb()
      .select({ id: competitions.id, name: competitions.name })
      .from(competitions)
      .where(eq(competitions.eventId, gallery.eventId))
      .orderBy(asc(competitions.position), asc(competitions.name)),
    listAuthors(),
    getDb()
      .select({
        id: photos.id,
        status: photos.status,
        thumbKey: photos.thumbKey,
        width: photos.width,
        height: photos.height,
        caption: photos.caption,
        capturedAt: photos.capturedAt,
        latitude: photos.latitude,
        longitude: photos.longitude,
        stageId: photos.stageId,
        spectators: photos.spectators,
        carName: cars.name,
      })
      .from(photos)
      .leftJoin(cars, eq(photos.carId, cars.id))
      .where(eq(photos.galleryId, gallery.id))
      .orderBy(desc(photos.createdAt)),
    getDb()
      .select({ photoId: photoCrews.photoId, crewEntryId: photoCrews.crewEntryId })
      .from(photoCrews)
      .innerJoin(photos, eq(photoCrews.photoId, photos.id))
      .where(eq(photos.galleryId, gallery.id))
      .orderBy(asc(photoCrews.position)),
  ]);

  const crewsByPhoto = new Map<string, string[]>();
  for (const link of linkRows) {
    const list = crewsByPhoto.get(link.photoId) ?? [];
    list.push(link.crewEntryId);
    crewsByPhoto.set(link.photoId, list);
  }

  return {
    gallery: {
      id: gallery.id,
      title: gallery.title,
      slug: gallery.slug,
      eventId: gallery.eventId,
      eventName: gallery.event.name,
      eventSlug: gallery.event.slug,
      authorId: gallery.authorId,
      authorName: gallery.author.name,
      heroPhotoId: gallery.event.heroPhotoId,
    },
    stages: stageRows,
    competitions: competitionRows,
    crews: crewRows,
    authors: authorRows.map((author) => ({ id: author.id, name: author.name })),
    photos: photoRows.map((photo) => ({
      id: photo.id,
      status: photo.status,
      thumbUrl: derivativeUrl(photo.thumbKey),
      width: photo.width,
      height: photo.height,
      caption: photo.caption,
      capturedAt: photo.capturedAt ? dateToWarsawInput(photo.capturedAt) : "",
      latitude: photo.latitude,
      longitude: photo.longitude,
      stageId: photo.stageId,
      crewEntryIds: crewsByPhoto.get(photo.id) ?? [],
      spectators: photo.spectators,
      carName: photo.carName,
    })),
  };
}
