"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PhotoCard } from "@/lib/gallery-data";
import type { RouteMap } from "@/lib/route-map";
import { spectatorsCrew, withQuery, type PublicQuery } from "@/lib/query";
import { buildTimeline } from "@/lib/timeline";
import { formatWarsaw } from "@/lib/time";

const PhotoMap = dynamic(() => import("./photo-map").then((mod) => mod.PhotoMap), { ssr: false });

const emptyQuery: PublicQuery = { view: "all", display: "grid", sort: "time" };
let closeInfo: (() => void) | null = null;
let closePace: (() => void) | null = null;

const slidePaces = [3, 5, 7, 10] as const;

const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_BACK = "cubic-bezier(0.55, 0, 0.2, 1)";
const FLIGHT_MS = 640;
const CARD_WIDTH = 292;

type Frame = { left: number; top: number; width: number; height: number };
type Flight = { phase: "from" | "open" | "back"; origin: Frame };

function aspectOf(photo: PhotoCard) {
  return photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1.5;
}

function layoutRows(photos: PhotoCard[], containerWidth: number, targetHeight: number, gap: number) {
  const rows: { height: number; photos: PhotoCard[] }[] = [];
  let row: PhotoCard[] = [];
  let aspectSum = 0;
  const flush = (stretch: boolean) => {
    if (!row.length) return;
    const gaps = gap * (row.length - 1);
    const height = stretch ? (containerWidth - gaps) / aspectSum : targetHeight;
    rows.push({ height, photos: row });
    row = [];
    aspectSum = 0;
  };
  for (const photo of photos) {
    row.push(photo);
    aspectSum += aspectOf(photo);
    const widthAtTarget = aspectSum * targetHeight + gap * (row.length - 1);
    if (widthAtTarget >= containerWidth) flush(true);
  }
  flush(false);
  return rows;
}

function uniqueText(values: (string | null | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function toFrame(rect: DOMRect): Frame {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function seedFrame(): Frame {
  const size = 56;
  return {
    left: window.innerWidth / 2 - size / 2,
    top: window.innerHeight / 2 - size / 2,
    width: size,
    height: size,
  };
}

function prefersReduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function fitFrame(aspect: number, viewport: { w: number; h: number }): Frame {
  const pad = 24;
  const film = 88;
  const maxW = Math.max(viewport.w - pad * 2, 1);
  const maxH = Math.max(viewport.h - pad - film, 1);
  let width = maxW;
  let height = width / aspect;
  if (height > maxH) {
    height = maxH;
    width = height * aspect;
  }
  return {
    left: (viewport.w - width) / 2,
    top: pad + (maxH - height) / 2,
    width,
    height,
  };
}

function flightTransform(origin: Frame, dest: Frame) {
  const scale = dest.width > 0 ? origin.width / dest.width : 1;
  const ox = origin.left + origin.width / 2;
  const oy = origin.top + origin.height / 2;
  const dx = dest.left + dest.width / 2;
  const dy = dest.top + dest.height / 2;
  return `translate(${ox - dx}px, ${oy - dy}px) scale(${scale})`;
}

function facts(photo: PhotoCard) {
  const rows: { label: string; value: string }[] = [];
  if (photo.spectators) rows.push({ label: "Zawodnicy", value: "Kibice" });
  for (const crew of photo.crews) {
    const names = [crew.driverName, crew.codriverName].filter(Boolean).join(" / ");
    rows.push({ label: "Załoga", value: names ? `nr ${crew.startNumber} · ${names}` : `nr ${crew.startNumber}` });
  }
  const classes = uniqueText(photo.crews.map((crew) => crew.className));
  const types = uniqueText(photo.crews.map((crew) => crew.competitionName));
  const crewCars = uniqueText(photo.crews.map((crew) => crew.car));
  if (photo.carName) {
    rows.push({ label: "Auto", value: photo.carName });
    if (classes.length) rows.push({ label: "Klasa", value: classes.join(", ") });
  } else if (crewCars.length === 1) {
    const car = [crewCars[0], classes.length === 1 ? classes[0] : null].filter(Boolean).join(" · ");
    if (car) rows.push({ label: "Auto", value: car });
  }
  if (types.length) rows.push({ label: "Typ", value: types.join(", ") });
  if (photo.stageCode) rows.push({ label: "Miejsce", value: `${photo.stageCode} ${photo.stageName ?? ""}`.trim() });
  if (photo.capturedAt) rows.push({ label: "Czas", value: formatWarsaw(new Date(photo.capturedAt)) });
  if (photo.caption) rows.push({ label: "Podpis", value: photo.caption });
  return rows;
}

const thumbPageSize = 10;

function ThumbStrip({ photos, index, onShow }: { photos: PhotoCard[]; index: number; onShow: (id: string) => void }) {
  const photoPage = Math.floor(index / thumbPageSize);
  const [page, setPage] = useState(photoPage);
  const stripRef = useRef<HTMLDivElement>(null);
  const pages = Math.ceil(photos.length / thumbPageSize);
  const start = page * thumbPageSize;
  const visible = photos.slice(start, start + thumbPageSize);

  useEffect(() => {
    setPage(photoPage);
  }, [photoPage]);

  useEffect(() => {
    const strip = stripRef.current;
    const active = strip?.querySelector<HTMLElement>("[data-current='true']");
    if (!strip || !active) return;
    const left = active.offsetLeft - strip.clientWidth / 2 + active.clientWidth / 2;
    strip.scrollTo({ left, behavior: "smooth" });
  }, [index, page]);

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-2 px-3 py-3">
      {pages > 1 ? (
        <button
          type="button"
          aria-label="Poprzednie miniaturki"
          disabled={page === 0}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15 text-paper disabled:opacity-30"
          onClick={() => setPage((current) => Math.max(0, current - 1))}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path d="M14 5L7 12l7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
          </svg>
        </button>
      ) : null}
      <div ref={stripRef} className="flex max-w-full gap-2 overflow-x-auto">
        {visible.map((item) => {
          const current = item.id === photos[index]?.id;
          return (
            <button
              key={item.id}
              type="button"
              data-current={current ? "true" : undefined}
              onClick={() => onShow(item.id)}
              className={`shrink-0 ${current ? "ring-2 ring-accent" : "opacity-70"}`}
            >
              <Image src={item.thumbUrl} alt="" width={72} height={48} unoptimized className="h-12 w-auto object-cover" style={{ width: "auto", height: "3rem" }} />
            </button>
          );
        })}
      </div>
      {pages > 1 ? (
        <button
          type="button"
          aria-label="Następne miniaturki"
          disabled={page >= pages - 1}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15 text-paper disabled:opacity-30"
          onClick={() => setPage((current) => Math.min(pages - 1, current + 1))}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path d="M10 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function secondsLabel(value: number) {
  if (value === 1) return "1 sekunda";
  if (value < 5) return `${value} sekundy`;
  return `${value} sekund`;
}

function activeFullscreen() {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function enterFullscreen(node: HTMLElement | null) {
  if (!node) return;
  const target = node as HTMLElement & { webkitRequestFullscreen?: () => void };
  if (target.requestFullscreen) {
    void target.requestFullscreen().catch(() => {});
    return;
  }
  target.webkitRequestFullscreen?.();
}

function leaveFullscreen() {
  const doc = document as Document & { webkitExitFullscreen?: () => void };
  if (document.fullscreenElement && document.exitFullscreen) {
    void document.exitFullscreen().catch(() => {});
    return;
  }
  doc.webkitExitFullscreen?.();
}

function PlayMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
    </svg>
  );
}

function PauseMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
    </svg>
  );
}

function InfoMark({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="7" r="1.2" fill="currentColor" />
      <path d="M12 11v7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

function InfoPlate({ photo, eventSlug, viewportWidth }: { photo: PhotoCard; eventSlug: string; viewportWidth: number }) {
  const [open, setOpen] = useState(false);
  const [fullHeight, setFullHeight] = useState(44);
  const cardWidth = Math.min(CARD_WIDTH, Math.max(viewportWidth - 32, 180));
  const rows = facts(photo);
  const curve = open ? EASE_OUT : EASE_BACK;
  const duration = open ? 560 : 420;
  const target = Math.max(fullHeight, 44);

  function measure(node: HTMLDivElement | null) {
    if (!node) return;
    const next = Math.min(node.offsetHeight, window.innerHeight * 0.62);
    setFullHeight((current) => (current === next ? current : next));
  }

  useEffect(() => {
    if (!open) return;
    closeInfo = () => setOpen(false);
    return () => {
      closeInfo = null;
    };
  }, [open]);

  return (
    <div className="absolute top-[4.25rem] right-4 z-30">
      <div
        className="relative overflow-hidden bg-panel text-ink shadow-[0_18px_40px_rgba(26,23,20,0.35)]"
        style={{
          width: open ? cardWidth : 44,
          height: open ? target : 44,
          borderRadius: open ? "16px 16px 16px 0" : 999,
          transition: `width ${duration}ms ${curve}, height ${duration}ms ${curve}, border-radius ${duration}ms ${curve}`,
        }}
      >
        <button
          type="button"
          className="absolute top-0 right-0 z-10 grid h-11 w-11 place-items-center text-ink"
          aria-expanded={open}
          aria-label={open ? "Zamknij informacje" : "Informacje o zdjęciu"}
          onClick={() => setOpen((value) => !value)}
        >
          <InfoMark open={open} />
        </button>
        <div
          key={`${photo.id}:${cardWidth}`}
          ref={measure}
          aria-hidden={!open}
          inert={open ? undefined : true}
          className="px-4 pt-3.5 pr-12 pb-4"
          style={{
            width: cardWidth,
            opacity: open ? 1 : 0,
            transition: open ? "opacity 220ms ease 120ms" : "opacity 80ms ease",
          }}
        >
          <p className="font-display text-2xl leading-none">{photo.authorName}</p>
          {rows.length > 0 ? (
            <dl className="mt-3 space-y-1.5 text-sm">
              {rows.map((row, index) => (
                <div key={`${row.label}-${index}`} className="grid grid-cols-[5.5rem_1fr] gap-2">
                  <dt className="text-muted">{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            <Link className="underline decoration-accent underline-offset-4" href={withQuery(`/${eventSlug}`, emptyQuery, { author: photo.authorSlug })}>
              Ten autor
            </Link>
            {photo.websiteUrl && photo.websiteLabel ? (
              <a className="underline decoration-accent underline-offset-4" href={photo.websiteUrl} target="_blank" rel="noreferrer">
                {photo.websiteLabel}
              </a>
            ) : null}
            {photo.stageSlug ? (
              <Link className="underline decoration-accent underline-offset-4" href={withQuery(`/${eventSlug}`, emptyQuery, { stage: photo.stageSlug })}>
                To miejsce
              </Link>
            ) : null}
            {photo.spectators ? (
              <Link className="underline decoration-accent underline-offset-4" href={withQuery(`/${eventSlug}`, emptyQuery, { crew: spectatorsCrew })}>
                Kibice
              </Link>
            ) : (
              photo.crews.map((crew) => (
                <Link
                  key={crew.startNumber}
                  className="underline decoration-accent underline-offset-4"
                  href={withQuery(`/${eventSlug}`, emptyQuery, { crew: crew.startNumber })}
                >
                  {photo.crews.length === 1 ? "Ta załoga" : `nr ${crew.startNumber}`}
                </Link>
              ))
            )}
            {photo.carSlug ? (
              <Link className="underline decoration-accent underline-offset-4" href={withQuery(`/${eventSlug}`, emptyQuery, { car: photo.carSlug })}>
                To auto
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Lightbox({
  photo,
  photos,
  eventSlug,
  flight,
  viewport,
  onShow,
  onClose,
  onFlightDone,
}: {
  photo: PhotoCard;
  photos: PhotoCard[];
  eventSlug: string;
  flight: Flight;
  viewport: { w: number; h: number };
  onShow: (id: string) => void;
  onClose: () => void;
  onFlightDone: () => void;
}) {
  const index = Math.max(photos.findIndex((item) => item.id === photo.id), 0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [seconds, setSeconds] = useState<(typeof slidePaces)[number]>(5);
  const [paceOpen, setPaceOpen] = useState(false);
  const doneRef = useRef(onFlightDone);
  const showRef = useRef(onShow);
  useEffect(() => {
    showRef.current = onShow;
  });

  useEffect(() => {
    if (!playing || photos.length < 2 || flight.phase !== "open") return;
    const timer = window.setInterval(() => {
      const current = photos.findIndex((item) => item.id === photo.id);
      if (current < 0) return;
      showRef.current(photos[(current + 1) % photos.length].id);
    }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [playing, photo.id, photos, flight.phase, seconds]);

  useEffect(() => {
    if (!paceOpen) return;
    closePace = () => setPaceOpen(false);
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && dialogRef.current?.querySelector("[data-pace]")?.contains(target)) return;
      setPaceOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => {
      closePace = null;
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [paceOpen]);

  useEffect(() => {
    const onFullscreen = () => {
      if (!activeFullscreen()) setPlaying(false);
    };
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("webkitfullscreenchange", onFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("webkitfullscreenchange", onFullscreen);
      if (activeFullscreen()) void leaveFullscreen();
    };
  }, []);

  function togglePlay() {
    const next = !playing;
    setPlaying(next);
    setPaceOpen(false);
    if (next) void enterFullscreen(dialogRef.current);
    else void leaveFullscreen();
  }
  useEffect(() => {
    doneRef.current = onFlightDone;
  });
  const [trackId, setTrackId] = useState(photo.id);
  const [outgoing, setOutgoing] = useState<PhotoCard | null>(null);
  const [revealed, setRevealed] = useState(true);
  const held = useRef(photo);
  if (photo.id !== trackId) {
    if (flight.phase === "open" && !prefersReduced()) setOutgoing(held.current);
    else setOutgoing(null);
    setTrackId(photo.id);
    setRevealed(flight.phase !== "open" || prefersReduced());
  }
  held.current = photo;

  useEffect(() => {
    if (revealed) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setRevealed(true);
    };
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(finish);
    });
    const timer = window.setTimeout(finish, 48);
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      window.clearTimeout(timer);
    };
  }, [revealed, photo.id]);

  useEffect(() => {
    if (!revealed || !outgoing) return;
    const timer = window.setTimeout(() => setOutgoing(null), 520);
    return () => window.clearTimeout(timer);
  }, [revealed, outgoing, photo.id]);

  const dest = fitFrame(aspectOf(photo), viewport);
  const flying = flight.phase !== "open";
  const duration = flight.phase === "back" ? 460 : FLIGHT_MS;
  const curve = flight.phase === "back" ? EASE_BACK : EASE_OUT;
  const settle = flight.phase === "open" ? `left 480ms ${EASE_OUT}, top 480ms ${EASE_OUT}, width 480ms ${EASE_OUT}, height 480ms ${EASE_OUT}` : "";

  useEffect(() => {
    if (flight.phase !== "back") return;
    const timer = window.setTimeout(() => doneRef.current(), duration + 80);
    return () => window.clearTimeout(timer);
  }, [flight.phase, duration]);

  return (
    <div ref={dialogRef} className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Podgląd zdjęcia">
      <button
        type="button"
        aria-label="Zamknij podgląd"
        className="absolute inset-0 bg-ink/92"
        style={{
          opacity: flight.phase === "open" ? 1 : 0,
          transition: flight.phase === "from" ? "none" : `opacity ${duration}ms ease`,
        }}
        onClick={onClose}
      />
      <div
        className="overflow-hidden bg-ink"
        onTransitionEnd={(event) => {
          if (event.target !== event.currentTarget || event.propertyName !== "transform" || flight.phase !== "back") return;
          doneRef.current();
        }}
        style={{
          position: "fixed",
          left: dest.left,
          top: dest.top,
          width: dest.width,
          height: dest.height,
          transform: flying ? flightTransform(flight.origin, dest) : "none",
          borderRadius: flying ? 8 : 2,
          transition: flight.phase === "from" ? "none" : `transform ${duration}ms ${curve}, border-radius ${duration}ms ${curve}${settle ? `, ${settle}` : ""}`,
        }}
      >
        <div className="absolute inset-0">
          {[outgoing, photo].filter((item): item is PhotoCard => item !== null).map((item) => {
            const onTop = item.id === photo.id;
            const opacity = onTop ? (revealed ? 1 : 0) : revealed ? 0 : 1;
            return (
              <Image
                key={item.id}
                src={item.viewUrl}
                alt={onTop ? item.caption || item.authorName : ""}
                fill
                unoptimized
                className="object-cover"
                sizes="100vw"
                style={{ opacity, zIndex: onTop ? 1 : 0, transition: "opacity 480ms ease" }}
              />
            );
          })}
        </div>
      </div>
      {photos.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Poprzednie"
            className="absolute top-1/2 left-3 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-paper"
            style={{ opacity: flight.phase === "open" ? 1 : 0, pointerEvents: flight.phase === "open" ? "auto" : "none", transition: "opacity 240ms ease 200ms" }}
            onClick={() => onShow(photos[(index - 1 + photos.length) % photos.length].id)}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M14 5L7 12l7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Następne"
            className="absolute top-1/2 right-3 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-paper"
            style={{ opacity: flight.phase === "open" ? 1 : 0, pointerEvents: flight.phase === "open" ? "auto" : "none", transition: "opacity 240ms ease 200ms" }}
            onClick={() => onShow(photos[(index + 1) % photos.length].id)}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M10 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
            </svg>
          </button>
        </>
      ) : null}
      <button
        type="button"
        aria-label="Zamknij podgląd"
        className="absolute top-4 right-4 z-40 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-paper"
        style={{ opacity: flight.phase === "open" ? 1 : 0, pointerEvents: flight.phase === "open" ? "auto" : "none", transition: "opacity 240ms ease 160ms" }}
        onClick={onClose}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
        </svg>
      </button>
      <div style={{ opacity: flight.phase === "open" ? 1 : 0, pointerEvents: flight.phase === "open" ? "auto" : "none", transition: flight.phase === "from" ? "none" : "opacity 220ms ease 180ms" }}>
        <InfoPlate photo={photo} eventSlug={eventSlug} viewportWidth={viewport.w} />
      </div>
      {photos.length > 1 ? (
        <div
          className="absolute bottom-[4.75rem] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2"
          style={{ opacity: flight.phase === "open" ? 1 : 0, pointerEvents: flight.phase === "open" ? "auto" : "none", transition: "opacity 240ms ease 180ms" }}
        >
          <button
            type="button"
            aria-pressed={playing}
            className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm text-paper backdrop-blur-sm"
            onClick={togglePlay}
          >
            {playing ? <PauseMark /> : <PlayMark />}
            {playing ? "Zatrzymaj pokaz" : "Odtwarzaj pokaz"}
          </button>
          <div className="relative" data-pace="">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={paceOpen}
              aria-label={`Długość slajdu, ${secondsLabel(seconds)}`}
              className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-xs font-medium text-paper backdrop-blur-sm"
              onClick={() => setPaceOpen((open) => !open)}
            >
              {seconds}s
            </button>
            {paceOpen ? (
              <div role="listbox" aria-label="Długość slajdu" className="absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 flex-col gap-1">
                {slidePaces.map((pace) => (
                  <button
                    key={pace}
                    type="button"
                    role="option"
                    aria-selected={pace === seconds}
                    className={`grid h-11 w-11 place-items-center rounded-full text-xs font-medium text-paper backdrop-blur-sm ${pace === seconds ? "bg-accent" : "bg-white/20"}`}
                    onClick={() => {
                      setSeconds(pace);
                      setPaceOpen(false);
                    }}
                  >
                    {pace}s
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {photos.length > 1 ? (
        <div style={{ opacity: flight.phase === "open" ? 1 : 0, pointerEvents: flight.phase === "open" ? "auto" : "none", transition: "opacity 240ms ease 180ms" }}>
          <ThumbStrip photos={photos} index={index} onShow={onShow} />
        </div>
      ) : null}
    </div>
  );
}

export function PhotoBrowser({
  photos,
  display,
  initialPhotoId,
  eventSlug,
  routes = null,
}: {
  photos: PhotoCard[];
  display: PublicQuery["display"];
  initialPhotoId?: string;
  eventSlug: string;
  routes?: RouteMap | null;
}) {
  const [openId, setOpenId] = useState(initialPhotoId ?? null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const frame = useRef<HTMLDivElement>(null);
  const thumbs = useRef(new Map<string, HTMLElement>());
  const booted = useRef(false);
  const openIdRef = useRef(openId);
  const showRef = useRef<(id: string | null, source?: HTMLElement) => void>(() => {});
  const [width, setWidth] = useState(0);
  const open = photos.find((photo) => photo.id === openId) ?? null;

  useEffect(() => {
    openIdRef.current = openId;
  }, [openId]);

  useEffect(() => {
    const read = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, [display]);

  function remember(id: string, node: HTMLElement | null) {
    if (node) thumbs.current.set(id, node);
    else thumbs.current.delete(id);
  }

  function show(id: string | null, source?: HTMLElement) {
    booted.current = true;
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("photo", id);
    else url.searchParams.delete("photo");
    window.history.replaceState(null, "", url);

    if (!id) {
      if (prefersReduced()) {
        setOpenId(null);
        setFlight(null);
        return;
      }
      setFlight((current) => {
        if (!current) return current;
        const currentId = openIdRef.current;
        const rect = currentId ? thumbs.current.get(currentId)?.getBoundingClientRect() : undefined;
        const visible = rect && rect.width > 0 && rect.bottom > 40 && rect.top < window.innerHeight - 40;
        return { phase: "back", origin: visible && rect ? toFrame(rect) : seedFrame() };
      });
      return;
    }

    setOpenId(id);
    setFlight((current) => {
      if (current && current.phase !== "back") return current;
      const rect = source?.getBoundingClientRect();
      return {
        phase: prefersReduced() ? "open" : "from",
        origin: rect && rect.width > 0 ? toFrame(rect) : seedFrame(),
      };
    });
  }

  useEffect(() => {
    showRef.current = show;
  });

  useEffect(() => {
    if (booted.current || !openId) return;
    if (display === "grid" && width === 0) return;
    booted.current = true;
    const rect = thumbs.current.get(openId)?.getBoundingClientRect();
    setFlight({
      phase: prefersReduced() ? "open" : "from",
      origin: rect && rect.width > 0 ? toFrame(rect) : seedFrame(),
    });
  }, [openId, display, width]);

  useEffect(() => {
    if (flight?.phase !== "from") return;
    const promote = () => setFlight((current) => (current?.phase === "from" ? { ...current, phase: "open" } : current));
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(promote);
    });
    const timer = window.setTimeout(promote, 48);
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      window.clearTimeout(timer);
    };
  }, [flight]);

  useEffect(() => {
    if (!openId) return;
    const onKey = (event: KeyboardEvent) => {
      const current = photos.findIndex((photo) => photo.id === openIdRef.current);
      if (current < 0) return;
      if (event.key === "Escape") {
        if (activeFullscreen()) return;
        if (closePace) closePace();
        else if (closeInfo) closeInfo();
        else showRef.current(null);
      }
      if (event.key === "ArrowRight") showRef.current(photos[(current + 1) % photos.length].id);
      if (event.key === "ArrowLeft") showRef.current(photos[(current - 1 + photos.length) % photos.length].id);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [openId, photos]);

  const rows = useMemo(() => {
    if (!width) return [];
    return layoutRows(photos, width, width < 720 ? 180 : 280, 8);
  }, [photos, width]);

  const placed = photos.filter((photo) => photo.latitude != null && photo.longitude != null).length;
  const timed = photos.filter((photo) => photo.capturedAt).length;
  const timeline = useMemo(() => buildTimeline(photos), [photos]);

  return (
    <div>
      {display === "map" ? (
        <div className="space-y-3">
          {photos.length - placed > 0 ? (
            <p className="text-sm text-muted">
              {photos.length - placed} {photos.length - placed === 1 ? "zdjęcie" : "zdjęć"} bez pinezki zostaje poza mapą.
            </p>
          ) : null}
          {routes && routes.features.length > 0 ? (
            <p className="text-sm text-muted">Na mapie jest trasa zapisana z mapy organizatora.</p>
          ) : null}
          <PhotoMap photos={photos} routes={routes} onOpen={show} />
        </div>
      ) : null}

      {display === "timeline" ? (
        <div className="space-y-8">
          {timeline.untimed > 0 ? (
            <p className="text-sm text-muted">
              {timeline.untimed} {timeline.untimed === 1 ? "zdjęcie" : "zdjęć"} bez czasu zostaje poza osią.
            </p>
          ) : null}
          {timeline.days.map((day) => (
            <section key={day.key} className="space-y-4">
              <h3 className="font-display text-2xl capitalize">{day.label}</h3>
              {day.stages.map((stage) => (
                <div key={stage.key} className="space-y-2">
                  <p className="text-sm text-muted">{stage.label}</p>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {stage.photos.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        ref={(node) => remember(photo.id, node)}
                        onClick={(event) => show(photo.id, event.currentTarget)}
                        className="shrink-0 transition-opacity duration-200"
                        style={{ opacity: openId === photo.id && flight && viewport.w > 0 ? 0 : 1 }}
                      >
                        <Image
                          src={photo.thumbUrl}
                          alt={photo.caption || photo.authorName}
                          width={180}
                          height={120}
                          unoptimized
                          className="h-28 w-auto rounded-md object-cover"
                          style={{ width: "auto", height: "7rem" }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
          {timed === 0 ? <p className="text-muted">W tym zestawie nie ma zdjęć z czasem wykonania.</p> : null}
        </div>
      ) : null}

      {display === "grid" ? (
        <div ref={frame} className="space-y-2">
          {photos.length === 0 ? <p className="text-muted">W tym zestawie nie ma jeszcze zdjęć.</p> : null}
          {rows.map((row, index) => (
            <div key={index} className="flex gap-2">
              {row.photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  ref={(node) => remember(photo.id, node)}
                  onClick={(event) => show(photo.id, event.currentTarget)}
                  className="relative overflow-hidden rounded-md bg-line transition-opacity duration-200"
                  style={{ width: row.height * aspectOf(photo), height: row.height, opacity: openId === photo.id && flight && viewport.w > 0 ? 0 : 1 }}
                >
                  <Image
                    src={photo.gridUrl}
                    alt={photo.caption || `${photo.authorName}${photo.stageCode ? `, ${photo.stageCode}` : ""}`}
                    fill
                    unoptimized
                    sizes="40vw"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {open && flight && viewport.w > 0 ? (
        <Lightbox
          photo={open}
          photos={photos}
          eventSlug={eventSlug}
          flight={flight}
          viewport={viewport}
          onShow={(id) => show(id)}
          onClose={() => show(null)}
          onFlightDone={() => {
            setOpenId(null);
            setFlight(null);
          }}
        />
      ) : null}
    </div>
  );
}
