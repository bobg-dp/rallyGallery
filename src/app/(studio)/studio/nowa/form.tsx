"use client";

import { useState } from "react";
import { createGallery } from "../actions";
import { ActionForm } from "@/components/action-form";
import { Field, SelectInput, TextInput } from "@/components/field";

export function NewGalleryForm({
  events,
  authors,
}: {
  events: { id: string; name: string }[];
  authors: { id: string; name: string }[];
}) {
  const [mode, setMode] = useState(authors.length ? "existing" : "new");
  return (
    <ActionForm action={createGallery} submit="Zapisz autora i otwórz wysyłkę" className="max-w-xl space-y-3">
      <Field label="Rajd">
        <SelectInput name="eventId" defaultValue={events[0]?.id} required>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label="Tytuł paczki, opcjonalnie">
        <TextInput name="title" placeholder="Sobota, OS 1–OS 4" />
      </Field>
      <Field label="Autor">
        <SelectInput name="authorMode" value={mode} onChange={(event) => setMode(event.target.value)}>
          <option value="existing">Z listy</option>
          <option value="new">Nowy autor</option>
        </SelectInput>
      </Field>
      {mode === "existing" ? (
        <Field label="Fotograf">
          <SelectInput name="authorId" defaultValue={authors[0]?.id} required>
            {authors.map((author) => (
              <option key={author.id} value={author.id}>
                {author.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      ) : (
        <>
          <Field label="Nazwa">
            <TextInput name="authorname" required />
          </Field>
          <Field label="Adres strony albo Facebooka">
            <TextInput name="authorwebsiteUrl" placeholder="https://" />
          </Field>
          <Field label="Etykieta linku">
            <TextInput name="authorwebsiteLabel" placeholder="Facebook" />
          </Field>
        </>
      )}
    </ActionForm>
  );
}
