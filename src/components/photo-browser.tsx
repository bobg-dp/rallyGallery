"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PhotoCard } from "@/lib/gallery-data";
import { withQuery, type PublicQuery } from "@/lib/query";
import { buildTimeline } from "@/lib/timeline";
import { formatWarsaw } from "@/lib/time";

const PhotoMap = dynamic(() => import("./photo-map").then((mod) => mod.PhotoMap), { ssr: false });

const emptyQuery: PublicQuery = { view: "all", display: "grid", sort: "time" };
let closeInfo: (() => void) | null = null;

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

function crewLine(photo: PhotoCard) {
  if (photo.startNumber == null) return null;
  const names = [photo.driverName, photo.codriverName].filter(Boolean).join(" / ");
  return names ? `nr ${photo.startNumber} · ${names}` : `nr ${photo.startNumber}`;
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
  const crew = crewLine(photo);
  if (crew) rows.push({ label: "Załoga", value: crew });
  const car = [photo.car, photo.className].filter(Boolean).join(" · ");
  if (car) rows.push({ label: "Auto", value: car });
  if (photo.competitionName) rows.push({ label: "Typ", value: photo.competitionName });
  if (photo.stageCode) rows.push({ label: "Odcinek", value: `${photo.stageCode} ${photo.stageName ?? ""}`.trim() });
  if (photo.capturedAt) rows.push({ label: "Czas", value: formatWarsaw(new Date(photo.capturedAt)) });
  if (photo.caption) rows.push({ label: "Podpis", value: photo.caption });
  return rows;
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
              {rows.map((row) => (
                <div key={row.label} className="grid grid-cols-[4.5rem_1fr] gap-2">
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
                Ten odcinek
              </Link>
            ) : null}
            {photo.startNumber != null ? (
              <Link className="underline decoration-accent underline-offset-4" href={withQuery(`/${eventSlug}`, emptyQuery, { crew: String(photo.startNumber) })}>
                Ta załoga
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
  const doneRef = useRef(onFlightDone);
  useEffect(() => {
    doneRef.current = onFlightDone;
  });
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
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Podgląd zdjęcia">
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
        <Image src={photo.viewUrl} alt={photo.caption || photo.authorName} fill unoptimized className="object-cover" sizes="100vw" />
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
          className="absolute inset-x-0 bottom-0 z-20 flex gap-2 overflow-x-auto px-4 py-3"
          style={{ opacity: flight.phase === "open" ? 1 : 0, pointerEvents: flight.phase === "open" ? "auto" : "none", transition: "opacity 240ms ease 180ms" }}
        >
          {photos.map((item) => (
            <button key={item.id} type="button" onClick={() => onShow(item.id)} className={item.id === photo.id ? "ring-2 ring-accent" : "opacity-70"}>
              <Image src={item.thumbUrl} alt="" width={72} height={48} unoptimized className="h-12 w-auto object-cover" style={{ width: "auto", height: "3rem" }} />
            </button>
          ))}
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
}: {
  photos: PhotoCard[];
  display: PublicQuery["display"];
  initialPhotoId?: string;
  eventSlug: string;
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
        if (closeInfo) closeInfo();
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
          <PhotoMap photos={photos} onOpen={show} />
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
