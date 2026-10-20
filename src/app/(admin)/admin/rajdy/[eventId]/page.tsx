import Image from "next/image";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { authors, competitions, crewEntries, events, galleries, people, photos, stages } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { btnDanger } from "@/components/styles";
import { Field, SelectInput, TextInput } from "@/components/field";
import { derivativeUrl } from "@/lib/storage";
import { createCompetition, createCrewEntry, createStage, deleteCompetition, deleteCrewEntry, deleteEvent, deleteEventPhoto, deleteStage, setCrewCompetition, updateEvent } from "../../actions";

const codrivers = alias(people, "event_codrivers");

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { eventId } = await params;
  const errorValue = (await searchParams).error;
  const error = Array.isArray(errorValue) ? errorValue[0] : errorValue;
  const event = await getDb().query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) notFound();
  const [stageRows, competitionRows, crewRows, photoRows] = await Promise.all([
    getDb().select().from(stages).where(eq(stages.eventId, eventId)).orderBy(asc(stages.position)),
    getDb().select().from(competitions).where(eq(competitions.eventId, eventId)).orderBy(asc(competitions.position), asc(competitions.name)),
    getDb()
      .select({
        id: crewEntries.id,
        startNumber: crewEntries.startNumber,
        className: crewEntries.className,
        car: crewEntries.car,
        competitionId: crewEntries.competitionId,
        driverName: people.name,
        codriverName: codrivers.name,
      })
      .from(crewEntries)
      .innerJoin(people, eq(crewEntries.driverId, people.id))
      .leftJoin(codrivers, eq(crewEntries.codriverId, codrivers.id))
      .where(eq(crewEntries.eventId, eventId))
      .orderBy(asc(crewEntries.startNumber)),
    getDb()
      .select({
        id: photos.id,
        caption: photos.caption,
        status: photos.status,
        thumbKey: photos.thumbKey,
        galleryTitle: galleries.title,
        authorName: authors.name,
      })
      .from(photos)
      .innerJoin(galleries, eq(photos.galleryId, galleries.id))
      .innerJoin(authors, eq(galleries.authorId, authors.id))
      .where(eq(galleries.eventId, eventId))
      .orderBy(desc(photos.createdAt)),
  ]);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">{event.name}</h1>
          {error ? <p className="mt-2 text-sm text-accent">{error}</p> : null}
        </div>
        <ConfirmSubmit
          action={deleteEvent.bind(null, event.id)}
          message="Usunąć ten rajd razem ze zdjęciami, miejscami i listą startową?"
          className={btnDanger}
        >
          Usuń rajd
        </ConfirmSubmit>
      </div>
      <ActionForm action={updateEvent.bind(null, event.id)} submit="Zapisz rajd" className="grid gap-3 rounded-xl border border-line bg-panel p-4 md:grid-cols-2">
        <Field label="Nazwa">
          <TextInput name="name" defaultValue={event.name} />
        </Field>
        <Field label="Kolejność">
          <TextInput name="position" type="number" defaultValue={event.position} />
        </Field>
        <Field label="Start">
          <TextInput name="startsOn" type="date" defaultValue={event.startsOn} />
        </Field>
        <Field label="Meta">
          <TextInput name="endsOn" type="date" defaultValue={event.endsOn ?? ""} />
        </Field>
        <Field label="Próg listy galerii">
          <TextInput name="galleryMinPhotos" type="number" defaultValue={event.galleryMinPhotos} />
        </Field>
      </ActionForm>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Miejsca</h2>
        <p className="max-w-xl text-sm text-muted">Odcinek specjalny, park serwisowy, meta albo inne miejsce na trasie.</p>
        <ul className="space-y-2">
          {stageRows.map((stage) => (
            <li key={stage.id} className="flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2 text-sm">
              <span>
                {stage.code} {stage.name} · dzień {stage.dayNumber}
              </span>
              <form action={deleteStage.bind(null, event.id, stage.id)}>
                <button className={btnDanger} type="submit">
                  Usuń
                </button>
              </form>
            </li>
          ))}
        </ul>
        <ActionForm action={createStage.bind(null, event.id)} submit="Dodaj miejsce" className="grid gap-3 md:grid-cols-4">
          <Field label="Kod">
            <TextInput name="code" placeholder="OS 1 albo PS" required />
          </Field>
          <Field label="Nazwa">
            <TextInput name="name" required />
          </Field>
          <Field label="Dzień">
            <TextInput name="dayNumber" type="number" defaultValue={1} />
          </Field>
          <Field label="Kolejność">
            <TextInput name="position" type="number" defaultValue={stageRows.length + 1} />
          </Field>
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Typy rajdu</h2>
        <p className="max-w-xl text-sm text-muted">
          Jedna impreza może mieć kilka typów, na przykład rajd okręgowy, rallysprint i KJS. Na stronie rajdu pojawiają się jako drugi poziom pod nazwą.
        </p>
        <ul className="space-y-2">
          {competitionRows.map((competition) => (
            <li key={competition.id} className="flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2 text-sm">
              <span>{competition.name}</span>
              <form action={deleteCompetition.bind(null, event.id, competition.id)}>
                <button className={btnDanger} type="submit">
                  Usuń
                </button>
              </form>
            </li>
          ))}
        </ul>
        <ActionForm action={createCompetition.bind(null, event.id)} submit="Dodaj typ" className="grid gap-3 md:grid-cols-2">
          <Field label="Nazwa">
            <TextInput name="name" placeholder="Rajd Okręgowy" required />
          </Field>
          <Field label="Kolejność">
            <TextInput name="position" type="number" defaultValue={competitionRows.length + 1} />
          </Field>
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Lista startowa</h2>
        <ul className="space-y-2">
          {crewRows.map((crew) => (
            <li key={crew.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-panel px-3 py-2 text-sm">
              <span>
                {crew.startNumber} {crew.driverName}
                {crew.codriverName ? ` / ${crew.codriverName}` : ""} · {crew.className} · {crew.car}
              </span>
              <div className="flex items-center gap-2">
                {competitionRows.length > 0 ? (
                  <ActionForm action={setCrewCompetition.bind(null, event.id, crew.id)} submit="Zapisz typ" className="flex items-end gap-2">
                    <SelectInput name="competitionId" defaultValue={crew.competitionId ?? ""}>
                      <option value="">Bez typu</option>
                      {competitionRows.map((competition) => (
                        <option key={competition.id} value={competition.id}>
                          {competition.name}
                        </option>
                      ))}
                    </SelectInput>
                  </ActionForm>
                ) : null}
                <form action={deleteCrewEntry.bind(null, event.id, crew.id)}>
                  <button className={btnDanger} type="submit">
                    Usuń
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
        <ActionForm action={createCrewEntry.bind(null, event.id)} submit="Dodaj załogę" className="grid gap-3 md:grid-cols-2">
          <Field label="Numer">
            <TextInput name="startNumber" inputMode="numeric" required />
          </Field>
          <Field label="Klasa">
            <TextInput name="className" required />
          </Field>
          {competitionRows.length > 0 ? (
            <Field label="Typ rajdu">
              <SelectInput name="competitionId" defaultValue="" required>
                <option value="">Wybierz typ</option>
                {competitionRows.map((competition) => (
                  <option key={competition.id} value={competition.id}>
                    {competition.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          ) : null}
          <Field label="Kierowca">
            <TextInput name="driver" required />
          </Field>
          <Field label="Pilot">
            <TextInput name="codriver" />
          </Field>
          <Field label="Auto">
            <TextInput name="car" required />
          </Field>
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Zdjęcia</h2>
        {photoRows.length === 0 ? <p className="text-sm text-muted">Ten rajd nie ma jeszcze zdjęć.</p> : null}
        <ul className="space-y-2">
          {photoRows.map((photo) => (
            <li key={photo.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel px-3 py-2">
              <div className="flex min-w-0 items-center gap-3">
                <Image
                  src={derivativeUrl(photo.thumbKey)}
                  alt=""
                  width={96}
                  height={72}
                  unoptimized
                  className="h-14 w-20 rounded object-cover"
                />
                <span className="min-w-0 text-sm">
                  <span className="block truncate">{photo.caption || photo.galleryTitle || photo.authorName}</span>
                  <span className="text-muted">
                    {photo.authorName}
                    {photo.galleryTitle ? ` · ${photo.galleryTitle}` : ""} · {photo.status === "published" ? "opublikowane" : "szkic"}
                  </span>
                </span>
              </div>
              <ConfirmSubmit
                action={deleteEventPhoto.bind(null, event.id, photo.id)}
                message="Usunąć to zdjęcie?"
                className={btnDanger}
              >
                Usuń
              </ConfirmSubmit>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
