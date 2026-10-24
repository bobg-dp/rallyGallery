"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { applyBulk, createCrew, deleteGallery, deletePhotos, setPublished, updateGallery } from "@/app/(studio)/studio/actions";
import { ActionForm } from "./action-form";
import { CarField } from "./car-field";
import { carForCrewSelection, CrewPicker } from "./crew-picker";
import { Field, SelectInput, TextInput } from "./field";
import { PhotoEditor } from "./photo-editor";
import type { RouteMap } from "@/lib/route-map";
import { btnDanger, btnGhost, btnPrimary } from "./styles";

const PinMap = dynamic(() => import("./pin-map").then((mod) => mod.PinMap), { ssr: false });

type Stage = { id: string; code: string; name: string; latitude: number | null; longitude: number | null };
type Crew = {
  id: string;
  startNumber: string;
  className: string;
  car: string;
  driverName: string | null;
  codriverName: string | null;
  competitionName: string | null;
};
type Photo = {
  id: string;
  status: "draft" | "published";
  thumbUrl: string;
  gridUrl: string;
  width: number;
  height: number;
  caption: string | null;
  capturedAt: string;
  latitude: number | null;
  longitude: number | null;
  stageId: string | null;
  crewEntryIds: string[];
  spectators: boolean;
  carName: string | null;
};

export function Desk({
  gallery,
  stages,
  routes,
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
  routes: RouteMap | null;
  competitions: { id: string; name: string; heroPhotoId: string | null }[];
  crews: Crew[];
  authors: { id: string; name: string }[];
  photos: Photo[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(photos[0] ? [photos[0].id] : []);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [authorMode, setAuthorMode] = useState("existing");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStageId, setBulkStageId] = useState("");
  const [bulkLatitude, setBulkLatitude] = useState<number | null>(null);
  const [bulkLongitude, setBulkLongitude] = useState<number | null>(null);
  const [pinMode, setPinMode] = useState<"" | "set" | "clear">("");
  const [focusPin, setFocusPin] = useState(0);
  const [bulkCrewIds, setBulkCrewIds] = useState<string[]>([]);
  const [bulkSpectators, setBulkSpectators] = useState(false);
  const [bulkUnchanged, setBulkUnchanged] = useState(true);
  const [bulkCar, setBulkCar] = useState("");
  const [applyCar, setApplyCar] = useState(false);
  const pinFromStage = useRef(false);
  const editorIndex = photos.findIndex((photo) => photo.id === editorId);
  const editor = editorIndex >= 0 ? photos[editorIndex] : null;

  function chooseBulkStage(nextId: string) {
    setBulkStageId(nextId);
    const stage = stages.find((item) => item.id === nextId);
    if (stage?.latitude != null && stage.longitude != null) {
      setBulkLatitude(stage.latitude);
      setBulkLongitude(stage.longitude);
      setPinMode("set");
      pinFromStage.current = true;
      setFocusPin((value) => value + 1);
      return;
    }
    if (pinFromStage.current) {
      setBulkLatitude(null);
      setBulkLongitude(null);
      setPinMode("");
      pinFromStage.current = false;
    }
  }

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
              <TextInput name="startNumber" placeholder="1, A albo 000kjs" />
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
            <Field label="Kierowca, opcjonalnie">
              <TextInput name="driver" placeholder="Zostaw puste przy aucie bez załogi" />
            </Field>
            <Field label="Pilot, opcjonalnie">
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

      <details className="rounded-xl border border-line bg-panel p-4" onToggle={(event) => setBulkOpen(event.currentTarget.open)}>
        <summary className="cursor-pointer text-sm">Zmień zaznaczone</summary>
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted">
            Miejsce i pinezka zapiszą się na zaznaczonych zdjęciach. Pozostałe pola zostają bez zmian, dopóki ich nie ustawisz.
          </p>
          <ActionForm action={applyBulk.bind(null, gallery.id)} submit="Zastosuj do zaznaczonych" className="grid gap-3 md:grid-cols-2">
            {selected.map((id) => (
              <input key={id} type="hidden" name="photoId" value={id} />
            ))}
            <Field label="Miejsce">
              <SelectInput name="stageId" value={bulkStageId} onChange={(event) => chooseBulkStage(event.target.value)}>
                <option value="">Bez zmian</option>
                <option value="clear">Usuń miejsce</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.code} {stage.name}
                    {stage.latitude != null && stage.longitude != null ? " · namiar" : ""}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <div className="block space-y-1.5 text-sm">
              <span className="text-muted">Zawodnicy</span>
              <CrewPicker
                crews={crews}
                crewIds={bulkCrewIds}
                spectators={bulkSpectators}
                unchanged={bulkUnchanged}
                allowUnchanged
                onChange={(next) => {
                  setBulkCrewIds(next.crewIds);
                  setBulkSpectators(next.spectators);
                  setBulkUnchanged(next.unchanged);
                  const filled = carForCrewSelection(bulkCar, crews, bulkCrewIds, next);
                  if (filled !== bulkCar || (next.added && next.crewIds.length === 1)) setApplyCar(true);
                  setBulkCar(filled);
                }}
              />
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" name="setCar" checked={applyCar} onChange={(event) => setApplyCar(event.target.checked)} />
              Ustaw auto
            </label>
            <Field label="Auto">
              <CarField value={bulkCar} onValueChange={setBulkCar} />
            </Field>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" name="setCaption" />
              Ustaw podpis
            </label>
            <Field label="Podpis">
              <TextInput name="caption" />
            </Field>
            <div className="space-y-2 md:col-span-2">
              <p className="text-sm text-muted">
                {pinMode === "clear"
                  ? "Pinezka zostanie zdjęta z zaznaczonych zdjęć."
                  : pinMode === "set"
                    ? "Ta pinezka trafi na zaznaczone zdjęcia. Możesz ją przesunąć."
                    : "Pinezka zostaje bez zmian, dopóki nie klikniesz mapy. Miejsce z namiaru stawia ją samo."}
                {routes && routes.features.length > 0 ? " Odcinki rajdu są na mapie." : ""}
              </p>
              {bulkOpen ? (
                <PinMap
                  latitude={bulkLatitude}
                  longitude={bulkLongitude}
                  routes={routes}
                  stageId={bulkStageId === "clear" ? "" : bulkStageId}
                  focusPin={focusPin}
                  onChange={(point) => {
                    setBulkLatitude(point.latitude);
                    setBulkLongitude(point.longitude);
                    setPinMode("set");
                    pinFromStage.current = false;
                  }}
                />
              ) : (
                <div className="h-80 rounded-lg border border-line" />
              )}
              <button
                type="button"
                className={btnGhost}
                onClick={() => {
                  setBulkLatitude(null);
                  setBulkLongitude(null);
                  setPinMode("clear");
                  pinFromStage.current = false;
                }}
              >
                Usuń pinezkę
              </button>
              <input type="hidden" name="pinMode" value={pinMode} />
              <input type="hidden" name="latitude" value={bulkLatitude ?? ""} />
              <input type="hidden" name="longitude" value={bulkLongitude ?? ""} />
            </div>
          </ActionForm>
        </div>
      </details>

      {photos.length === 0 ? <p className="text-sm text-muted">Wgraj zdjęcia, a potem wybierz kadr.</p> : null}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo) => (
          <div key={photo.id} className={`relative overflow-hidden rounded-md border ${editor?.id === photo.id ? "border-accent" : "border-transparent"}`}>
            <button type="button" className="block w-full" onClick={() => setEditorId(photo.id)} aria-label="Edytuj metadane">
              <Image src={photo.thumbUrl} alt="" width={320} height={220} unoptimized className="aspect-[4/3] w-full object-cover" />
            </button>
            <label className="absolute top-2 left-2 flex items-center gap-1 rounded bg-panel/90 px-2 py-1 text-xs">
              <input type="checkbox" checked={selected.includes(photo.id)} onChange={() => toggle(photo.id)} />
              {photo.status === "published" ? "opublikowane" : "szkic"}
            </label>
            {competitions.some((competition) => competition.heroPhotoId === photo.id) ? (
              <span className="absolute top-2 right-2 max-w-[58%] truncate rounded bg-ink px-2 py-1 text-xs text-paper">
                {competitions.find((competition) => competition.heroPhotoId === photo.id)?.name}
              </span>
            ) : gallery.heroPhotoId === photo.id ? (
              <span className="absolute top-2 right-2 rounded bg-ink px-2 py-1 text-xs text-paper">Hero</span>
            ) : null}
          </div>
        ))}
      </div>
      {editor ? (
        <PhotoEditor
          key={editor.id}
          galleryId={gallery.id}
          heroPhotoId={gallery.heroPhotoId}
          competitions={competitions}
          photo={editor}
          stages={stages}
          routes={routes}
          crews={crews}
          index={editorIndex}
          total={photos.length}
          onPrev={editorIndex > 0 ? () => setEditorId(photos[editorIndex - 1].id) : undefined}
          onNext={editorIndex < photos.length - 1 ? () => setEditorId(photos[editorIndex + 1].id) : undefined}
          onClose={() => setEditorId(null)}
        />
      ) : null}
    </div>
  );
}

