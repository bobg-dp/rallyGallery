import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { competitions, crewEntries, events, galleries, photos, stages } from "@/db/schema";
import { deleteObject } from "@/lib/storage";

async function removeFiles(rows: { originalKey: string; thumbKey: string; gridKey: string; viewKey: string }[]) {
  for (const row of rows) {
    await deleteObject(row.originalKey);
    await deleteObject(row.thumbKey);
    await deleteObject(row.gridKey);
    await deleteObject(row.viewKey);
  }
}

export async function purgeEvent(eventId: string) {
  const event = await getDb().query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return null;

  const galleryRows = await getDb().select({ id: galleries.id }).from(galleries).where(eq(galleries.eventId, eventId));
  const galleryIds = galleryRows.map((row) => row.id);
  const photoRows = galleryIds.length
    ? await getDb()
        .select({
          id: photos.id,
          originalKey: photos.originalKey,
          thumbKey: photos.thumbKey,
          gridKey: photos.gridKey,
          viewKey: photos.viewKey,
        })
        .from(photos)
        .where(inArray(photos.galleryId, galleryIds))
    : [];

  await getDb().transaction(async (tx) => {
    if (photoRows.length) {
      await tx.delete(photos).where(
        inArray(
          photos.id,
          photoRows.map((row) => row.id),
        ),
      );
    }
    await tx.delete(crewEntries).where(eq(crewEntries.eventId, eventId));
    await tx.delete(competitions).where(eq(competitions.eventId, eventId));
    await tx.delete(stages).where(eq(stages.eventId, eventId));
    await tx.delete(galleries).where(eq(galleries.eventId, eventId));
    await tx.delete(events).where(eq(events.id, eventId));
  });

  await removeFiles(photoRows);
  return event.slug;
}
