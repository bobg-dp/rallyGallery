"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { savePhoto, setCompetitionHero, setEventHero } from "@/app/(studio)/studio/actions";
import { ActionForm } from "./action-form";
import { CarField } from "./car-field";
import { carForCrewSelection, carTextForCrews, CrewPicker, type CrewOption } from "./crew-picker";
import { Field, SelectInput, TextInput } from "./field";
import { btnGhost, btnPrimary } from "./styles";
import type { RouteMap } from "@/lib/route-map";

const PinMap = dynamic(() => import("./pin-map").then((mod) => mod.PinMap), { ssr: false });

type Stage = { id: string; code: string; name: string; latitude: number | null; longitude: number | null };
type Crew = CrewOption;
type Photo = {
  id: string;
  status: "draft" | "published";
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

export function PhotoEditor({
  galleryId,
  heroPhotoId,
  competitions,
  photo,
  stages,
  routes,
  crews,
  index,
  total,
  onPrev,
  onNext,
  onClose,
}: {
  galleryId: string;
  heroPhotoId: string | null;
  competitions: { id: string; name: string; heroPhotoId: string | null }[];
  photo: Photo;
  stages: Stage[];
  routes: RouteMap | null;
  crews: Crew[];
  index: number;
  total: number;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [carName, setCarName] = useState(photo.carName || carTextForCrews(crews, photo.crewEntryIds));
  const [crewIds, setCrewIds] = useState(photo.crewEntryIds);
  const [spectators, setSpectators] = useState(photo.spectators);
  const [stageId, setStageId] = useState(photo.stageId ?? "");
  const [latitude, setLatitude] = useState<number | null>(photo.latitude);
  const [longitude, setLongitude] = useState<number | null>(photo.longitude);
  const [focusPin, setFocusPin] = useState(0);

  const onCloseRef = useRef(onClose);
  const onPrevRef = useRef(onPrev);
  const onNextRef = useRef(onNext);
  useEffect(() => {
    onCloseRef.current = onClose;
    onPrevRef.current = onPrev;
    onNextRef.current = onNext;
  }, [onClose, onPrev, onNext]);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      event.preventDefault();
      if (event.key === "ArrowLeft") onPrevRef.current?.();
      else onNextRef.current?.();
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function chooseStage(nextId: string) {
    setStageId(nextId);
    const stage = stages.find((item) => item.id === nextId);
    if (stage?.latitude != null && stage.longitude != null) {
      setLatitude(stage.latitude);
      setLongitude(stage.longitude);
      setFocusPin((value) => value + 1);
    }
  }

  const placed = stages.find((stage) => stage.id === stageId);
  const fromPlace = placed?.latitude != null && placed.longitude != null && latitude === placed.latitude && longitude === placed.longitude;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-3 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Metadane zdjęcia"
        className="grid max-h-[92dvh] w-full max-w-5xl overflow-y-auto rounded-xl bg-paper shadow-xl md:grid-cols-[minmax(0,1fr)_380px] md:overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative flex min-h-52 items-center justify-center bg-ink">
          <Image
            src={photo.gridUrl}
            alt=""
            width={photo.width}
            height={photo.height}
            unoptimized
            className="max-h-[42dvh] w-full object-contain md:max-h-[92dvh]"
          />
          {total > 1 ? (
            <>
              <button
                type="button"
                aria-label="Poprzednie zdjęcie"
                disabled={!onPrev}
                className={`${btnGhost} absolute top-1/2 left-3 -translate-y-1/2 bg-paper px-3 disabled:opacity-40`}
                onClick={onPrev}
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Następne zdjęcie"
                disabled={!onNext}
                className={`${btnGhost} absolute top-1/2 right-3 -translate-y-1/2 bg-paper px-3 disabled:opacity-40`}
                onClick={onNext}
              >
                →
              </button>
            </>
          ) : null}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            {total > 1 ? <span className="rounded-md bg-paper px-3 py-2 text-sm">{index + 1} / {total}</span> : null}
            <button type="button" className={`${btnGhost} bg-paper`} onClick={onClose}>
              Zamknij
            </button>
          </div>
        </div>
        <div className="space-y-4 p-4 md:max-h-[92dvh] md:overflow-y-auto">
          <ActionForm action={savePhoto.bind(null, galleryId, photo.id)} submit="Zapisz kadr">
            <Field label="Miejsce">
              <SelectInput key={stageId} name="stageId" defaultValue={stageId} onChange={(event) => chooseStage(event.target.value)}>
                <option value="">Bez miejsca</option>
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
                crewIds={crewIds}
                spectators={spectators}
                onChange={(next) => {
                  setCrewIds(next.crewIds);
                  setSpectators(next.spectators);
                  setCarName(carForCrewSelection(carName, crews, crewIds, next));
                }}
              />
            </div>
            <Field label="Auto">
              <CarField value={carName} onValueChange={setCarName} />
            </Field>
            <Field label="Czas wykonania">
              <TextInput name="capturedAt" type="datetime-local" defaultValue={photo.capturedAt} />
            </Field>
            <Field label="Podpis">
              <TextInput name="caption" defaultValue={photo.caption ?? ""} />
            </Field>
            <input type="hidden" name="latitude" value={latitude ?? ""} />
            <input type="hidden" name="longitude" value={longitude ?? ""} />
          </ActionForm>
          {total > 1 ? (
            <div className="flex gap-2">
              <button type="button" className={`${btnGhost} flex-1`} disabled={!onPrev} onClick={onPrev}>
                Poprzednie
              </button>
              <button type="button" className={`${btnGhost} flex-1`} disabled={!onNext} onClick={onNext}>
                Następne
              </button>
            </div>
          ) : null}
          {competitions.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted">Hero dla typu rajdu. Zdjęcia zmieniają się na stronie, a nazwa rajdu zostaje.</p>
              {competitions.map((competition) => {
                const active = competition.heroPhotoId === photo.id;
                return (
                  <button
                    key={competition.id}
                    type="button"
                    className={`${active ? btnGhost : btnPrimary} w-full`}
                    onClick={() => {
                      void setCompetitionHero(galleryId, competition.id, active ? null : photo.id).then(() => router.refresh());
                    }}
                  >
                    {active ? `Zdejmij · ${competition.name}` : `Hero · ${competition.name}`}
                  </button>
                );
              })}
            </div>
          ) : (
            <button
              type="button"
              className={heroPhotoId === photo.id ? btnGhost : btnPrimary}
              onClick={() => {
                const next = heroPhotoId === photo.id ? null : photo.id;
                void setEventHero(galleryId, next).then(() => router.refresh());
              }}
            >
              {heroPhotoId === photo.id ? "Zdejmij z hero" : "Ustaw jako hero"}
            </button>
          )}
          {photo.status !== "published" ? (
            <p className="text-sm text-muted">Na stronie rajdu hero pojawi się dopiero po publikacji tego kadru.</p>
          ) : null}
          <div className="space-y-2">
            <p className="text-sm text-muted">
              {fromPlace
                ? "Pinezka pochodzi z namiaru miejsca. Zapisuje się razem z kadrem."
                : "Pinezka jest opcjonalna. Kliknij mapę albo przeciągnij znacznik, a potem zapisz kadr."}
              {routes && routes.features.length > 0 ? " Odcinki rajdu są na mapie, żeby łatwiej trafić w miejsce zdjęcia." : ""}
            </p>
            <PinMap
              key={photo.id}
              latitude={latitude}
              longitude={longitude}
              routes={routes}
              stageId={stageId}
              focusPin={focusPin}
              onChange={(point) => {
                setLatitude(point.latitude);
                setLongitude(point.longitude);
              }}
            />
            <button
              type="button"
              className={btnGhost}
              onClick={() => {
                setLatitude(null);
                setLongitude(null);
              }}
            >
              Usuń pinezkę
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

