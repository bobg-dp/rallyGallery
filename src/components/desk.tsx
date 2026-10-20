"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  applyBulk,
  createCrew,
  deleteGallery,
  deletePhotos,
  savePhoto,
  setEventHero,
  setLocation,
  setPublished,
  updateGallery,
} from "@/app/(studio)/studio/actions";
import { ActionForm } from "./action-form";
import { Field, SelectInput, TextInput } from "./field";
import { btnDanger, btnGhost, btnPrimary } from "./styles";

const PinMap = dynamic(() => import("./pin-map").then((mod) => mod.PinMap), { ssr: false });

type Stage = { id: string; code: string; name: string };
type Crew = {
  id: string;
  startNumber: number;
  className: string;
  car: string;
  driverName: string;
  codriverName: string | null;
  competitionName: string | null;
};
type Photo = {
  id: string;
  status: "draft" | "published";
  thumbUrl: string;
  caption: string | null;
  capturedAt: string;
  latitude: number | null;
  longitude: number | null;
  stageId: string | null;
  crewEntryId: string | null;
};

export function Desk({
  gallery,
  stages,
  competitions,
  crews,
  authors,
  photos,
}: {
  gallery: {
    id: string;
    title: string | null;
    slug: string;
    eventName: string;
    eventSlug: string;
    authorId: string;
    authorName: string;
    heroPhotoId: string | null;
  };
  stages: Stage[];
  competitions: { id: string; name: string }[];
  crews: Crew[];
  authors: { id: string; name: string }[];
  photos: Photo[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(photos[0] ? [photos[0].id] : []);
  const [focusedId, setFocusedId] = useState(photos[0]?.id ?? "");
  const [authorMode, setAuthorMode] = useState("existing");
  const focused = photos.find((photo) => photo.id === focusedId) ?? photos[0];

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function publish(published: boolean) {
    await setPublished(gallery.id, selected, published);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("Usunąć zaznaczone zdjęcia?")) return;
    await deletePhotos(gallery.id, selected);
    setSelected([]);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{gallery.eventName}</p>
          <h1 className="font-display text-4xl">{gallery.title || gallery.authorName}</h1>
          <p className="text-sm text-muted">{gallery.authorName}</p>
        </div>
        <div className="flex gap-2">
          <Link className={btnGhost} href={`/${gallery.eventSlug}/g/${gallery.slug}`}>
            Podgląd
          </Link>
          <form
            action={async () => {
              if (!window.confirm("Usunąć całą paczkę razem ze zdjęciami?")) return;
              await deleteGallery(gallery.id);
            }}
          >
            <button className={btnDanger} type="submit">
              Usuń paczkę
            </button>
          </form>
        </div>
      </div>

      <ActionForm action={updateGallery.bind(null, gallery.id)} submit="Zapisz paczkę" className="grid gap-3 rounded-xl border border-line bg-panel p-4 md:grid-cols-2">
        <Field label="Tytuł, opcjonalnie">
          <TextInput name="title" defaultValue={gallery.title ?? ""} />
        </Field>
        <Field label="Autor">
          <SelectInput name="authorMode" value={authorMode} onChange={(event) => setAuthorMode(event.target.value)}>
            <option value="existing">Z listy</option>
            <option value="new">Nowy autor</option>
          </SelectInput>
        </Field>
        {authorMode === "existing" ? (
          <Field label="Fotograf">
            <SelectInput name="authorId" defaultValue={gallery.authorId}>
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
              <TextInput name="authorname" />
            </Field>
            <Field label="Adres">
              <TextInput name="authorwebsiteUrl" placeholder="https://" />
            </Field>
            <Field label="Etykieta linku">
              <TextInput name="authorwebsiteLabel" placeholder="Facebook" />
            </Field>
          </>
        )}
      </ActionForm>

      <details className="rounded-xl border border-line bg-panel p-4">
        <summary className="cursor-pointer text-sm">Dopisz brakującą załogę</summary>
        <div className="mt-3">
          <ActionForm action={createCrew.bind(null, gallery.id)} submit="Dodaj załogę" className="grid gap-3 md:grid-cols-2">
            <Field label="Numer">
              <TextInput name="startNumber" inputMode="numeric" />
            </Field>
            <Field label="Klasa">
              <TextInput name="className" />
            </Field>
            {competitions.length > 0 ? (
              <Field label="Typ rajdu">
                <SelectInput name="competitionId" defaultValue="" required>
                  <option value="">Wybierz typ</option>
                  {competitions.map((competition) => (
                    <option key={competition.id} value={competition.id}>
                      {competition.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            ) : null}
            <Field label="Kierowca">
              <TextInput name="driver" />
            </Field>
            <Field label="Pilot">
              <TextInput name="codriver" />
            </Field>
            <Field label="Auto">
              <TextInput name="car" />
            </Field>
          </ActionForm>
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnGhost} onClick={() => setSelected(photos.map((photo) => photo.id))}>
          Zaznacz wszystkie
        </button>
        <button type="button" className={btnPrimary} onClick={() => void publish(true)}>
          Publikuj zaznaczone
        </button>
        <button type="button" className={btnGhost} onClick={() => void publish(false)}>
          Cofnij publikację
        </button>
        <button type="button" className={btnDanger} onClick={() => void remove()}>
          Usuń zaznaczone
        </button>
      </div>

      <ActionForm action={applyBulk.bind(null, gallery.id)} submit="Zastosuj do zaznaczonych" className="grid gap-3 rounded-xl border border-line bg-panel p-4 md:grid-cols-2">
        {selected.map((id) => (
          <input key={id} type="hidden" name="photoId" value={id} />
        ))}
        <Field label="Odcinek">
          <SelectInput name="stageId" defaultValue="">
            <option value="">Bez zmian</option>
            <option value="clear">Usuń odcinek</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.code} {stage.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Załoga">
          <SelectInput name="crewEntryId" defaultValue="">
            <option value="">Bez zmian</option>
            <option value="clear">Usuń załogę</option>
            {crews.map((crew) => (
              <option key={crew.id} value={crew.id}>
                {crew.startNumber} {crew.driverName}
                {crew.codriverName ? ` / ${crew.codriverName}` : ""}
                {crew.competitionName ? ` · ${crew.competitionName}` : ""}
              </option>
            ))}
          </SelectInput>
        </Field>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="setCaption" />
          Ustaw podpis
        </label>
        <Field label="Podpis">
          <TextInput name="caption" />
        </Field>
      </ActionForm>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className={`relative overflow-hidden rounded-md border ${focused?.id === photo.id ? "border-accent" : "border-transparent"}`}>
              <button type="button" className="block w-full" onClick={() => setFocusedId(photo.id)}>
                <Image src={photo.thumbUrl} alt="" width={320} height={220} unoptimized className="aspect-[4/3] w-full object-cover" />
              </button>
              <label className="absolute top-2 left-2 flex items-center gap-1 rounded bg-panel/90 px-2 py-1 text-xs">
                <input type="checkbox" checked={selected.includes(photo.id)} onChange={() => toggle(photo.id)} />
                {photo.status === "published" ? "opublikowane" : "szkic"}
              </label>
              {gallery.heroPhotoId === photo.id ? (
                <span className="absolute top-2 right-2 rounded bg-ink px-2 py-1 text-xs text-paper">Hero</span>
              ) : null}
            </div>
          ))}
        </div>
        {focused ? (
          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <ActionForm key={focused.id} action={savePhoto.bind(null, gallery.id, focused.id)} submit="Zapisz kadr">
              <Field label="Odcinek">
                <SelectInput name="stageId" defaultValue={focused.stageId ?? ""}>
                  <option value="">Bez odcinka</option>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.code} {stage.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Załoga">
                <SelectInput name="crewEntryId" defaultValue={focused.crewEntryId ?? ""}>
                  <option value="">Bez załogi</option>
                  {crews.map((crew) => (
                    <option key={crew.id} value={crew.id}>
                      {crew.startNumber} {crew.driverName}
                      {crew.codriverName ? ` / ${crew.codriverName}` : ""}
                      {crew.competitionName ? ` · ${crew.competitionName}` : ""}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Czas wykonania">
                <TextInput name="capturedAt" type="datetime-local" defaultValue={focused.capturedAt} />
              </Field>
              <Field label="Podpis">
                <TextInput name="caption" defaultValue={focused.caption ?? ""} />
              </Field>
            </ActionForm>
            <button
              type="button"
              className={gallery.heroPhotoId === focused.id ? btnGhost : btnPrimary}
              onClick={() => {
                const next = gallery.heroPhotoId === focused.id ? null : focused.id;
                void setEventHero(gallery.id, next).then(() => router.refresh());
              }}
            >
              {gallery.heroPhotoId === focused.id ? "Zdejmij z hero" : "Ustaw jako hero"}
            </button>
            {focused.status !== "published" && gallery.heroPhotoId !== focused.id ? (
              <p className="text-sm text-muted">Na stronie rajdu hero pojawi się dopiero po publikacji tego kadru.</p>
            ) : null}
            <div className="space-y-2">
              <p className="text-sm text-muted">Pinezka jest opcjonalna. Kliknij mapę albo przeciągnij znacznik.</p>
              <PinMap
                key={focused.id}
                latitude={focused.latitude}
                longitude={focused.longitude}
                onChange={(point) => {
                  void setLocation(focused.id, point.latitude, point.longitude).then(() => router.refresh());
                }}
              />
              <button
                type="button"
                className={btnGhost}
                onClick={() => {
                  void setLocation(focused.id, null, null).then(() => router.refresh());
                }}
              >
                Usuń pinezkę
              </button>
            </div>
          </aside>
        ) : (
          <p className="text-sm text-muted">Wgraj zdjęcia, a potem wybierz kadr.</p>
        )}
      </div>
    </div>
  );
}
