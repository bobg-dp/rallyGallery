"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { authors, competitions, crewEntries, events, galleries, photoCrews, photos, stages } from "@/db/schema";
import { parseAuthorFields, readString, type FormState } from "@/lib/form";
import { requireUser } from "@/lib/current-user";
import { eventSlugTaken, findOrCreateCar, findOrCreatePerson, normalizeCarName, slugTaken } from "@/lib/records";
import { deleteObject, photoKeys } from "@/lib/storage";
import { uniqueSlug } from "@/lib/slug";
import { normalizeStartNumber, startNumberError, startNumberKey } from "@/lib/start-number";
import { warsawLocalToDate } from "@/lib/time";

const CREW_ID = /^[0-9a-f-]{36}$/i;
const MAX_PHOTO_CREWS = 30;

async function readCrewAssignment(eventId: string, formData: FormData) {
  const mode = formData.has("crewMode") ? readString(formData, "crewMode") : "set";
  if (mode === "") return { skip: true as const };
  if (mode === "clear") return { spectators: false, crewIds: [] as string[] };
  if (mode !== "set") return { error: "Wybierz zawodników." as const };
  const spectators = formData.get("spectators") === "1";
  const crewIds = [
    ...new Set(
      formData
        .getAll("crewEntryId")
        .map((value) => String(value))
        .filter((value) => CREW_ID.test(value)),
    ),
  ];
  if (spectators && crewIds.length) return { error: "Kibice i zawodnicy nie mogą być ustawieni razem." as const };
  if (spectators) return { spectators: true, crewIds: [] as string[] };
  if (crewIds.length > MAX_PHOTO_CREWS) return { error: "Na jednym zdjęciu może być najwyżej 30 zawodników." as const };
  if (crewIds.length) {
    const rows = await getDb()
      .select({ id: crewEntries.id })
      .from(crewEntries)
      .where(and(eq(crewEntries.eventId, eventId), inArray(crewEntries.id, crewIds)));
    if (rows.length !== crewIds.length) return { error: "Wybierz zawodników z tego rajdu." as const };
  }
  return { spectators: false, crewIds };
}

async function replacePhotoCrews(
  photoIds: string[],
  assignment: { spectators: boolean; crewIds: string[] },
  extra: {
    stageId?: string | null;
    carId?: string | null;
    caption?: string | null;
    capturedAt?: Date | null;
  } = {},
) {
  if (!photoIds.length) return;
  await getDb().transaction(async (tx) => {
    await tx
      .update(photos)
      .set({ ...extra, spectators: assignment.spectators })
      .where(inArray(photos.id, photoIds));
    await tx.delete(photoCrews).where(inArray(photoCrews.photoId, photoIds));
    if (assignment.crewIds.length) {
      await tx.insert(photoCrews).values(
        photoIds.flatMap((photoId) => assignment.crewIds.map((crewEntryId, position) => ({ photoId, crewEntryId, position }))),
      );
    }
  });
}

function refresh(galleryId: string, eventSlug?: string) {
  revalidatePath(`/studio/${galleryId}`);
  revalidatePath("/studio");
  if (eventSlug) {
    revalidatePath(`/${eventSlug}`);
  }
}

export async function createGallery(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const eventId = readString(formData, "eventId");
  const title = readString(formData, "title");
  const authorMode = readString(formData, "authorMode");
  const eventRow = await getDb().query.events.findFirst({ where: eq(events.id, eventId) });
  if (!eventRow) return { error: "Wybierz rajd." };

  let authorId = readString(formData, "authorId");
  if (authorMode === "new" || !authorId) {
    const parsed = parseAuthorFields(formData, "author");
    if (!parsed.ok) return parsed;
    const slug = await uniqueSlug(parsed.value.name, (candidate) => slugTaken("authors", candidate));
    const [author] = await getDb()
      .insert(authors)
      .values({ ...parsed.value, slug })
      .returning();
    authorId = author.id;
  } else {
    const author = await getDb().query.authors.findFirst({ where: eq(authors.id, authorId) });
    if (!author) return { error: "Wybierz autora." };
  }

  const slug = await uniqueSlug(title || "galeria", (candidate) => eventSlugTaken(eventRow.id, "galleries", candidate));
  const [gallery] = await getDb()
    .insert(galleries)
    .values({
      eventId: eventRow.id,
      authorId,
      title: title || null,
      slug,
      createdById: user.id,
    })
    .returning();
  redirect(`/studio/${gallery.id}`);
}

export async function updateGallery(galleryId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const gallery = await getDb().query.galleries.findFirst({ where: eq(galleries.id, galleryId) });
  if (!gallery) return { error: "Nie ma takiej galerii." };
  const title = readString(formData, "title");
  const authorMode = readString(formData, "authorMode");
  let authorId = readString(formData, "authorId") || gallery.authorId;
  if (authorMode === "new") {
    const parsed = parseAuthorFields(formData, "author");
    if (!parsed.ok) return parsed;
    const slug = await uniqueSlug(parsed.value.name, (candidate) => slugTaken("authors", candidate));
    const [author] = await getDb()
      .insert(authors)
      .values({ ...parsed.value, slug })
      .returning();
    authorId = author.id;
  }
  await getDb()
    .update(galleries)
    .set({ title: title || null, authorId })
    .where(eq(galleries.id, galleryId));
  const event = await getDb().query.events.findFirst({ where: eq(events.id, gallery.eventId) });
  refresh(galleryId, event?.slug);
  return {};
}

export async function createCrew(galleryId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const gallery = await getDb().query.galleries.findFirst({ where: eq(galleries.id, galleryId) });
  if (!gallery) return { error: "Nie ma takiej galerii." };
  const startNumber = normalizeStartNumber(readString(formData, "startNumber"));
  const driver = readString(formData, "driver");
  const codriver = readString(formData, "codriver");
  const className = readString(formData, "className");
  const car = readString(formData, "car");
  const numberError = startNumberError(startNumber);
  if (numberError) return { error: numberError };
  if (!driver || !className || !car) return { error: "Uzupełnij kierowcę, klasę i auto." };
  const taken = await getDb().query.crewEntries.findFirst({
    where: and(eq(crewEntries.eventId, gallery.eventId), sql`lower(${crewEntries.startNumber}) = ${startNumberKey(startNumber)}`),
  });
  if (taken) return { error: "Ten numer startowy już jest na liście." };
  const driverId = await findOrCreatePerson(driver);
  const codriverId = codriver ? await findOrCreatePerson(codriver) : null;
  if (codriverId && codriverId === driverId) return { error: "Kierowca i pilot muszą być różnymi osobami." };
  const competitionId = readString(formData, "competitionId");
  const types = await getDb().query.competitions.findFirst({ where: eq(competitions.eventId, gallery.eventId) });
  let resolvedCompetition: string | null = null;
  if (competitionId) {
    const row = await getDb().query.competitions.findFirst({
      where: and(eq(competitions.id, competitionId), eq(competitions.eventId, gallery.eventId)),
    });
    if (!row) return { error: "Wybierz typ z tego rajdu." };
    resolvedCompetition = row.id;
  } else if (types) {
    return { error: "Wybierz typ rajdu." };
  }
  await getDb().insert(crewEntries).values({
    eventId: gallery.eventId,
    startNumber,
    className,
    car,
    driverId,
    codriverId,
    competitionId: resolvedCompetition,
  });
  const event = await getDb().query.events.findFirst({ where: eq(events.id, gallery.eventId) });
  refresh(galleryId, event?.slug);
  return {};
}

function ids(formData: FormData) {
  return formData
    .getAll("photoId")
    .map((value) => String(value))
    .filter((value) => /^[0-9a-f-]{36}$/i.test(value));
}

export async function savePhoto(galleryId: string, photoId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const gallery = await getDb().query.galleries.findFirst({ where: eq(galleries.id, galleryId) });
  if (!gallery) return { error: "Nie ma takiej galerii." };
  const stageId = readString(formData, "stageId");
  const caption = readString(formData, "caption");
  const carName = normalizeCarName(readString(formData, "carName"));
  const capturedRaw = readString(formData, "capturedAt");
  if (caption.length > 400) return { error: "Podpis jest za długi." };
  if (carName.length > 80) return { error: "Nazwa auta jest za długa." };
  if (stageId) {
    const stage = await getDb().query.stages.findFirst({
      where: and(eq(stages.id, stageId), eq(stages.eventId, gallery.eventId)),
    });
    if (!stage) return { error: "Wybierz miejsce z tego rajdu." };
  }
  const crew = await readCrewAssignment(gallery.eventId, formData);
  if ("error" in crew) return { error: crew.error };
  if ("skip" in crew) return { error: "Wybierz zawodników." };
  const capturedAt = capturedRaw ? warsawLocalToDate(capturedRaw) : null;
  if (capturedRaw && !capturedAt) return { error: "Sprawdź czas wykonania." };
  const carId = carName ? await findOrCreateCar(carName) : null;
  const [owned] = await getDb()
    .select({ id: photos.id })
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.galleryId, galleryId)))
    .limit(1);
  if (!owned) return { error: "Nie ma takiego zdjęcia." };
  await replacePhotoCrews([owned.id], crew, {
    stageId: stageId || null,
    carId,
    caption: caption || null,
    capturedAt,
  });
  const event = await getDb().query.events.findFirst({ where: eq(events.id, gallery.eventId) });
  refresh(galleryId, event?.slug);
  return {};
}

export async function applyBulk(galleryId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const gallery = await getDb().query.galleries.findFirst({ where: eq(galleries.id, galleryId) });
  if (!gallery) return { error: "Nie ma takiej galerii." };
  const photoIds = ids(formData);
  if (!photoIds.length) return { error: "Zaznacz zdjęcia." };
  const patch: {
    stageId?: string | null;
    carId?: string | null;
    caption?: string | null;
  } = {};
  const stageId = readString(formData, "stageId");
  const caption = readString(formData, "caption");
  const setCaption = formData.get("setCaption") === "on";
  if (stageId === "clear") patch.stageId = null;
  else if (stageId) {
    const stage = await getDb().query.stages.findFirst({
      where: and(eq(stages.id, stageId), eq(stages.eventId, gallery.eventId)),
    });
    if (!stage) return { error: "Wybierz miejsce z tego rajdu." };
    patch.stageId = stageId;
  }
  const crew = await readCrewAssignment(gallery.eventId, formData);
  if ("error" in crew) return { error: crew.error };
  if (setCaption) {
    if (caption.length > 400) return { error: "Podpis jest za długi." };
    patch.caption = caption || null;
  }
  if (formData.get("setCar") === "on") {
    const carName = normalizeCarName(readString(formData, "carName"));
    if (carName.length > 80) return { error: "Nazwa auta jest za długa." };
    patch.carId = carName ? await findOrCreateCar(carName) : null;
  }
  if (!Object.keys(patch).length && "skip" in crew) return { error: "Wybierz, co zmienić." };
  const owned = await getDb()
    .select({ id: photos.id })
    .from(photos)
    .where(and(eq(photos.galleryId, galleryId), inArray(photos.id, photoIds)));
  if (!owned.length) return { error: "Zaznacz zdjęcia." };
  const ownedIds = owned.map((row) => row.id);
  if ("skip" in crew) {
    await getDb().update(photos).set(patch).where(inArray(photos.id, ownedIds));
  } else {
    await replacePhotoCrews(ownedIds, crew, patch);
  }
  const event = await getDb().query.events.findFirst({ where: eq(events.id, gallery.eventId) });
  refresh(galleryId, event?.slug);
  return {};
}

export async function setLocation(photoId: string, latitude: number | null, longitude: number | null) {
  await requireUser();
  if (latitude != null && (latitude < -90 || latitude > 90 || longitude == null || longitude < -180 || longitude > 180)) {
    return;
  }
  const [photo] = await getDb()
    .select({ id: photos.id, galleryId: photos.galleryId })
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);
  if (!photo) return;
  await getDb()
    .update(photos)
    .set({ latitude, longitude: latitude == null ? null : longitude })
    .where(eq(photos.id, photoId));
  const gallery = await getDb().query.galleries.findFirst({ where: eq(galleries.id, photo.galleryId) });
  const event = gallery ? await getDb().query.events.findFirst({ where: eq(events.id, gallery.eventId) }) : null;
  refresh(photo.galleryId, event?.slug);
}

export async function setPublished(galleryId: string, photoIds: string[], published: boolean) {
  await requireUser();
  const clean = photoIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (!clean.length) return;
  await getDb()
    .update(photos)
    .set(published ? { status: "published", publishedAt: new Date() } : { status: "draft", publishedAt: null })
    .where(and(eq(photos.galleryId, galleryId), inArray(photos.id, clean)));
  const gallery = await getDb().query.galleries.findFirst({ where: eq(galleries.id, galleryId) });
  const event = gallery ? await getDb().query.events.findFirst({ where: eq(events.id, gallery.eventId) }) : null;
  refresh(galleryId, event?.slug);
}

export async function setEventHero(galleryId: string, photoId: string | null) {
  await requireUser();
  const gallery = await getDb().query.galleries.findFirst({ where: eq(galleries.id, galleryId) });
  if (!gallery) return;
  if (photoId) {
    const [photo] = await getDb()
      .select({ id: photos.id })
      .from(photos)
      .innerJoin(galleries, eq(photos.galleryId, galleries.id))
      .where(and(eq(photos.id, photoId), eq(galleries.eventId, gallery.eventId)))
      .limit(1);
    if (!photo) return;
  }
  await getDb().update(events).set({ heroPhotoId: photoId }).where(eq(events.id, gallery.eventId));
  const event = await getDb().query.events.findFirst({ where: eq(events.id, gallery.eventId) });
  refresh(galleryId, event?.slug);
}

export async function deletePhotos(galleryId: string, photoIds: string[]) {
  await requireUser();
  const clean = photoIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (!clean.length) return;
  const rows = await getDb()
    .select()
    .from(photos)
    .where(and(eq(photos.galleryId, galleryId), inArray(photos.id, clean)));
  for (const row of rows) {
    await deleteObject(row.originalKey);
    await deleteObject(row.thumbKey);
    await deleteObject(row.gridKey);
    await deleteObject(row.viewKey);
  }
  await getDb().delete(photos).where(and(eq(photos.galleryId, galleryId), inArray(photos.id, clean)));
  const gallery = await getDb().query.galleries.findFirst({ where: eq(galleries.id, galleryId) });
  const event = gallery ? await getDb().query.events.findFirst({ where: eq(events.id, gallery.eventId) }) : null;
  refresh(galleryId, event?.slug);
}

export async function deleteGallery(galleryId: string) {
  await requireUser();
  const rows = await getDb().select().from(photos).where(eq(photos.galleryId, galleryId));
  for (const row of rows) {
    const keys = photoKeys(row.id);
    await deleteObject(keys.originalKey);
    await deleteObject(keys.thumbKey);
    await deleteObject(keys.gridKey);
    await deleteObject(keys.viewKey);
    await deleteObject(row.originalKey);
  }
  const gallery = await getDb().query.galleries.findFirst({ where: eq(galleries.id, galleryId) });
  await getDb().delete(galleries).where(eq(galleries.id, galleryId));
  if (gallery) {
    const event = await getDb().query.events.findFirst({ where: eq(events.id, gallery.eventId) });
    if (event) revalidatePath(`/${event.slug}`);
  }
  revalidatePath("/studio");
  redirect("/studio");
}
