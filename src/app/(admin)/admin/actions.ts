"use server";

import bcrypt from "bcryptjs";
import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { authors, competitions, crewEntries, events, galleries, photoCrews, photos, series, sessions, stages, users } from "@/db/schema";
import { requireAdmin } from "@/lib/current-user";
import { parseAuthorFields, readString, type FormState } from "@/lib/form";
import { isLogin, normalizeLogin } from "@/lib/login";
import { purgeEvent } from "@/lib/remove-event";
import { findOrCreatePerson, slugTaken } from "@/lib/records";
import { parseStartListCsv } from "@/lib/start-list-csv";
import { deleteObject } from "@/lib/storage";
import { slugify, uniqueSlug } from "@/lib/slug";
import { normalizeStartNumber, startNumberError, startNumberKey } from "@/lib/start-number";

function eventPath(eventId: string, error?: string) {
  return error ? `/admin/rajdy/${eventId}?error=${encodeURIComponent(error)}` : `/admin/rajdy/${eventId}`;
}

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const name = readString(formData, "name");
  const email = normalizeLogin(readString(formData, "login"));
  const password = readString(formData, "password");
  const role = readString(formData, "role") === "admin" ? "admin" : "editor";
  if (!name || !isLogin(email) || password.length < 8) {
    return { error: "Podaj imię, login od 2 do 80 znaków bez spacji i hasło o długości co najmniej 8 znaków." };
  }
  const existing = await getDb().query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return { error: "To konto już istnieje." };
  await getDb().insert(users).values({
    name,
    email,
    role,
    passwordHash: await bcrypt.hash(password, 12),
  });
  revalidatePath("/admin/uzytkownicy");
  return {};
}

export async function updateUser(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdmin();
  const name = readString(formData, "name");
  const role = readString(formData, "role") === "admin" ? "admin" : "editor";
  const password = readString(formData, "password");
  const disabled = formData.get("disabled") === "on";
  if (!name) return { error: "Podaj imię." };
  if (password && password.length < 8) return { error: "Hasło musi mieć co najmniej 8 znaków." };
  if (actor.id === userId && (disabled || role !== "admin")) {
    return { error: "Nie wyłączysz własnego konta administratora." };
  }
  if (role !== "admin" || disabled) {
    const [{ count }] = await getDb()
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(users)
      .where(and(eq(users.role, "admin"), sql`${users.disabledAt} is null`, ne(users.id, userId)));
    const target = await getDb().query.users.findFirst({ where: eq(users.id, userId) });
    if (target?.role === "admin" && !target.disabledAt && count < 1) {
      return { error: "Zostaw co najmniej jednego aktywnego administratora." };
    }
  }
  await getDb()
    .update(users)
    .set({
      name,
      role,
      disabledAt: disabled ? new Date() : null,
      ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
    })
    .where(eq(users.id, userId));
  if (disabled) await getDb().delete(sessions).where(eq(sessions.userId, userId));
  revalidatePath("/admin/uzytkownicy");
  return {};
}

export async function createSeries(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const name = readString(formData, "name");
  if (!name) return { error: "Podaj nazwę cyklu." };
  const slug = await uniqueSlug(name, (candidate) => slugTaken("series", candidate));
  await getDb().insert(series).values({ name, slug });
  revalidatePath("/admin/cykle");
  return {};
}

export async function updateSeries(seriesId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const name = readString(formData, "name");
  if (!name) return { error: "Podaj nazwę cyklu." };
  await getDb().update(series).set({ name }).where(eq(series.id, seriesId));
  revalidatePath("/admin/cykle");
  return {};
}

export async function createEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const seriesId = readString(formData, "seriesId");
  const name = readString(formData, "name");
  const startsOn = readString(formData, "startsOn");
  const endsOn = readString(formData, "endsOn");
  const position = Number(readString(formData, "position") || "0");
  const galleryMinPhotos = Number(readString(formData, "galleryMinPhotos") || "8");
  if (!seriesId || !name || !/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) {
    return { error: "Wybierz cykl, nazwę i datę startu." };
  }
  if (!Number.isInteger(galleryMinPhotos) || galleryMinPhotos < 1 || galleryMinPhotos > 500) {
    return { error: "Próg galerii musi być liczbą od 1 do 500." };
  }
  const parent = await getDb().query.series.findFirst({ where: eq(series.id, seriesId) });
  if (!parent) return { error: "Wybierz cykl." };
  const slug = await uniqueSlug(name, (candidate) => slugTaken("events", candidate));
  const [event] = await getDb()
    .insert(events)
    .values({
      seriesId,
      name,
      slug,
      startsOn,
      endsOn: /^\d{4}-\d{2}-\d{2}$/.test(endsOn) ? endsOn : null,
      position: Number.isInteger(position) ? position : 0,
      galleryMinPhotos,
    })
    .returning();
  revalidatePath("/admin/rajdy");
  redirect(`/admin/rajdy/${event.id}`);
}

export async function updateEvent(eventId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const name = readString(formData, "name");
  const startsOn = readString(formData, "startsOn");
  const endsOn = readString(formData, "endsOn");
  const position = Number(readString(formData, "position") || "0");
  const galleryMinPhotos = Number(readString(formData, "galleryMinPhotos") || "8");
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) return { error: "Podaj nazwę i datę startu." };
  if (!Number.isInteger(galleryMinPhotos) || galleryMinPhotos < 1 || galleryMinPhotos > 500) {
    return { error: "Próg galerii musi być liczbą od 1 do 500." };
  }
  await getDb()
    .update(events)
    .set({
      name,
      startsOn,
      endsOn: /^\d{4}-\d{2}-\d{2}$/.test(endsOn) ? endsOn : null,
      position: Number.isInteger(position) ? position : 0,
      galleryMinPhotos,
    })
    .where(eq(events.id, eventId));
  revalidatePath(`/admin/rajdy/${eventId}`);
  const event = await getDb().query.events.findFirst({ where: eq(events.id, eventId) });
  if (event) revalidatePath(`/${event.slug}`);
  return {};
}

export async function createStage(eventId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const code = readString(formData, "code");
  const name = readString(formData, "name");
  const dayNumber = Number(readString(formData, "dayNumber") || "1");
  const position = Number(readString(formData, "position") || "0");
  if (!code || !name) return { error: "Podaj kod i nazwę miejsca." };
  const slug = await uniqueSlug(code, async (candidate) => {
    const row = await getDb().query.stages.findFirst({
      where: and(eq(stages.eventId, eventId), eq(stages.slug, candidate)),
    });
    return Boolean(row);
  });
  await getDb().insert(stages).values({
    eventId,
    code,
    name,
    slug,
    dayNumber: Number.isInteger(dayNumber) && dayNumber > 0 ? dayNumber : 1,
    position: Number.isInteger(position) ? position : 0,
  });
  revalidatePath(`/admin/rajdy/${eventId}`);
  return {};
}

export async function deleteStage(eventId: string, stageId: string) {
  await requireAdmin();
  const [used] = await getDb().select({ id: photos.id }).from(photos).where(eq(photos.stageId, stageId)).limit(1);
  if (used) redirect(eventPath(eventId, "To miejsce ma już zdjęcia."));
  await getDb().delete(stages).where(and(eq(stages.id, stageId), eq(stages.eventId, eventId)));
  revalidatePath(`/admin/rajdy/${eventId}`);
}

export async function createCompetition(eventId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const name = readString(formData, "name");
  const position = Number(readString(formData, "position") || "0");
  if (!name) return { error: "Podaj nazwę typu." };
  const slug = await uniqueSlug(name, async (candidate) => {
    const [row] = await getDb()
      .select({ id: competitions.id })
      .from(competitions)
      .where(and(eq(competitions.eventId, eventId), eq(competitions.slug, candidate)))
      .limit(1);
    return Boolean(row);
  });
  await getDb().insert(competitions).values({
    eventId,
    name,
    slug,
    position: Number.isInteger(position) ? position : 0,
  });
  revalidatePath(`/admin/rajdy/${eventId}`);
  const event = await getDb().query.events.findFirst({ where: eq(events.id, eventId) });
  if (event) revalidatePath(`/${event.slug}`);
  return {};
}

export async function deleteCompetition(eventId: string, competitionId: string) {
  await requireAdmin();
  const used = await getDb().query.crewEntries.findFirst({ where: eq(crewEntries.competitionId, competitionId) });
  if (used) redirect(eventPath(eventId, "Ten typ ma już załogi."));
  await getDb().delete(competitions).where(and(eq(competitions.id, competitionId), eq(competitions.eventId, eventId)));
  revalidatePath(`/admin/rajdy/${eventId}`);
}

async function competitionForEvent(eventId: string, competitionId: string) {
  if (!competitionId) return { id: null as string | null };
  const row = await getDb().query.competitions.findFirst({
    where: and(eq(competitions.id, competitionId), eq(competitions.eventId, eventId)),
  });
  return row ? { id: row.id } : null;
}

export async function setCrewCompetition(eventId: string, crewId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const competition = await competitionForEvent(eventId, readString(formData, "competitionId"));
  if (!competition) return { error: "Wybierz typ z tego rajdu." };
  await getDb()
    .update(crewEntries)
    .set({ competitionId: competition.id })
    .where(and(eq(crewEntries.id, crewId), eq(crewEntries.eventId, eventId)));
  revalidatePath(`/admin/rajdy/${eventId}`);
  const event = await getDb().query.events.findFirst({ where: eq(events.id, eventId) });
  if (event) revalidatePath(`/${event.slug}`);
  return {};
}

export async function createCrewEntry(eventId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const startNumber = normalizeStartNumber(readString(formData, "startNumber"));
  const driver = readString(formData, "driver");
  const codriver = readString(formData, "codriver");
  const className = readString(formData, "className");
  const car = readString(formData, "car");
  const numberError = startNumberError(startNumber);
  if (numberError) return { error: numberError };
  if (!driver || !className || !car) return { error: "Uzupełnij kierowcę, klasę i auto." };
  const taken = await getDb().query.crewEntries.findFirst({
    where: and(eq(crewEntries.eventId, eventId), sql`lower(${crewEntries.startNumber}) = ${startNumberKey(startNumber)}`),
  });
  if (taken) return { error: "Ten numer startowy już jest na liście." };
  const driverId = await findOrCreatePerson(driver);
  const codriverId = codriver ? await findOrCreatePerson(codriver) : null;
  if (codriverId && codriverId === driverId) return { error: "Kierowca i pilot muszą być różnymi osobami." };
  const competition = await competitionForEvent(eventId, readString(formData, "competitionId"));
  if (!competition) return { error: "Wybierz typ z tego rajdu." };
  const types = await getDb().query.competitions.findFirst({ where: eq(competitions.eventId, eventId) });
  if (types && !competition.id) return { error: "Wybierz typ rajdu." };
  await getDb().insert(crewEntries).values({
    eventId,
    startNumber,
    className,
    car,
    driverId,
    codriverId,
    competitionId: competition.id,
  });
  revalidatePath(`/admin/rajdy/${eventId}`);
  return {};
}

function crewsAddedLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (count === 1) return "Dodano 1 załogę.";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `Dodano ${count} załogi.`;
  return `Dodano ${count} załóg.`;
}

export async function importCrewEntries(eventId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const event = await getDb().query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return { error: "Nie ma takiego rajdu." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Wybierz plik CSV." };
  if (file.size > 1024 * 1024) return { error: "Plik jest większy niż 1 MB." };
  const parsed = parseStartListCsv(await file.text());
  if ("error" in parsed) return parsed;

  const competition = await competitionForEvent(eventId, readString(formData, "competitionId"));
  if (!competition) return { error: "Wybierz typ z tego rajdu." };

  const existing = await getDb()
    .select({ startNumber: crewEntries.startNumber })
    .from(crewEntries)
    .where(eq(crewEntries.eventId, eventId));
  const taken = new Set(existing.map((row) => startNumberKey(row.startNumber)));
  const fresh = parsed.rows.filter((row) => !taken.has(startNumberKey(row.startNumber)));
  const skipped = parsed.rows.filter((row) => taken.has(startNumberKey(row.startNumber))).map((row) => row.startNumber);
  const samePerson = fresh.find((row) => row.codriver && slugify(row.driver) === slugify(row.codriver));
  if (samePerson) return { error: `Wiersz ${samePerson.line}: kierowca i pilot muszą być różnymi osobami.` };

  for (const row of fresh) {
    const driverId = await findOrCreatePerson(row.driver);
    const codriverId = row.codriver ? await findOrCreatePerson(row.codriver) : null;
    await getDb().insert(crewEntries).values({
      eventId,
      startNumber: row.startNumber,
      className: row.className,
      car: row.car,
      driverId,
      codriverId,
      competitionId: competition.id,
    });
  }

  revalidatePath(`/admin/rajdy/${eventId}`);
  revalidatePath(`/${event.slug}`);
  if (!fresh.length) return { error: `Wszystkie numery są już na liście: ${skipped.join(", ")}.` };
  const skippedNote = skipped.length ? ` Pominięto numery już na liście: ${skipped.join(", ")}.` : "";
  return { message: `${crewsAddedLabel(fresh.length)}${skippedNote}` };
}

export async function deleteCrewEntry(eventId: string, crewId: string) {
  await requireAdmin();
  const [used] = await getDb()
    .select({ photoId: photoCrews.photoId })
    .from(photoCrews)
    .where(eq(photoCrews.crewEntryId, crewId))
    .limit(1);
  if (used) redirect(eventPath(eventId, "Ta załoga ma już zdjęcia."));
  await getDb().delete(crewEntries).where(and(eq(crewEntries.id, crewId), eq(crewEntries.eventId, eventId)));
  revalidatePath(`/admin/rajdy/${eventId}`);
}

export async function createAuthor(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseAuthorFields(formData);
  if (!parsed.ok) return parsed;
  const slug = await uniqueSlug(parsed.value.name, (candidate) => slugTaken("authors", candidate));
  await getDb().insert(authors).values({ ...parsed.value, slug });
  revalidatePath("/admin/autorzy");
  return {};
}

export async function updateAuthor(authorId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseAuthorFields(formData);
  if (!parsed.ok) return parsed;
  await getDb().update(authors).set(parsed.value).where(eq(authors.id, authorId));
  revalidatePath("/admin/autorzy");
  return {};
}

export async function deleteAuthor(authorId: string) {
  await requireAdmin();
  const used = await getDb().query.galleries.findFirst({ where: eq(galleries.authorId, authorId) });
  if (used) redirect("/admin/autorzy?error=Ten autor ma już galerię.");
  await getDb().delete(authors).where(eq(authors.id, authorId));
  revalidatePath("/admin/autorzy");
}

function revalidateAfterRemoval(slug?: string | null) {
  if (slug) revalidatePath(`/${slug}`);
  revalidatePath("/");
  revalidatePath("/admin/rajdy");
  revalidatePath("/admin/cykle");
  revalidatePath("/studio", "layout");
}

export async function deleteSeries(seriesId: string) {
  await requireAdmin();
  const eventRows = await getDb().select({ id: events.id }).from(events).where(eq(events.seriesId, seriesId));
  for (const event of eventRows) {
    const slug = await purgeEvent(event.id);
    if (slug) revalidatePath(`/${slug}`);
  }
  await getDb().delete(series).where(eq(series.id, seriesId));
  revalidateAfterRemoval();
}

export async function deleteEvent(eventId: string) {
  await requireAdmin();
  const slug = await purgeEvent(eventId);
  revalidateAfterRemoval(slug);
  redirect("/admin/rajdy");
}

export async function deleteEventPhoto(eventId: string, photoId: string) {
  await requireAdmin();
  const [row] = await getDb()
    .select({
      id: photos.id,
      originalKey: photos.originalKey,
      thumbKey: photos.thumbKey,
      gridKey: photos.gridKey,
      viewKey: photos.viewKey,
    })
    .from(photos)
    .innerJoin(galleries, eq(photos.galleryId, galleries.id))
    .where(and(eq(photos.id, photoId), eq(galleries.eventId, eventId)))
    .limit(1);
  if (!row) return;
  await getDb().delete(photos).where(eq(photos.id, row.id));
  await deleteObject(row.originalKey);
  await deleteObject(row.thumbKey);
  await deleteObject(row.gridKey);
  await deleteObject(row.viewKey);
  const event = await getDb().query.events.findFirst({ where: eq(events.id, eventId) });
  revalidatePath(`/admin/rajdy/${eventId}`);
  revalidateAfterRemoval(event?.slug);
}
