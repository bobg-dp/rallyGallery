import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { events, series } from "@/db/schema";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Field, SelectInput, TextInput } from "@/components/field";
import { btnDanger } from "@/components/styles";
import { createEvent, deleteEvent } from "../actions";

export default async function Page() {
  const [eventRows, seriesRows] = await Promise.all([
    getDb().select().from(events).orderBy(asc(events.startsOn)),
    getDb().select().from(series).orderBy(asc(series.name)),
  ]);
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <h1 className="font-display text-4xl">Rajdy</h1>
        <ul className="divide-y divide-line rounded-xl border border-line bg-panel">
          {eventRows.map((event) => (
            <li key={event.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <Link href={`/admin/rajdy/${event.id}`} className="min-w-0">
                {event.name}
                <span className="ml-2 text-sm text-muted">{event.startsOn}</span>
              </Link>
              <ConfirmSubmit
                action={deleteEvent.bind(null, event.id)}
                message="Usunąć ten rajd razem ze zdjęciami, odcinkami i listą startową?"
                className={btnDanger}
              >
                Usuń
              </ConfirmSubmit>
            </li>
          ))}
        </ul>
      </div>
      {seriesRows.length ? (
        <ActionForm action={createEvent} submit="Załóż rajd" className="h-fit space-y-3 rounded-xl border border-line bg-panel p-4">
          <h2 className="font-display text-2xl">Nowy rajd</h2>
          <Field label="Cykl">
            <SelectInput name="seriesId" defaultValue={seriesRows[0]?.id}>
              {seriesRows.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Nazwa">
            <TextInput name="name" required />
          </Field>
          <Field label="Start">
            <TextInput name="startsOn" type="date" required />
          </Field>
          <Field label="Meta">
            <TextInput name="endsOn" type="date" />
          </Field>
          <Field label="Kolejność w cyklu">
            <TextInput name="position" type="number" defaultValue={0} />
          </Field>
          <Field label="Próg listy galerii">
            <TextInput name="galleryMinPhotos" type="number" defaultValue={8} />
          </Field>
        </ActionForm>
      ) : (
        <p className="text-sm text-muted">Najpierw załóż cykl.</p>
      )}
    </div>
  );
}
