import Link from "next/link";
import type { getEventBundle } from "@/lib/gallery-data";
import { spectatorsCrew, withQuery, type PublicQuery } from "@/lib/query";
import { inputClass } from "./styles";

type Bundle = NonNullable<Awaited<ReturnType<typeof getEventBundle>>>;

const views = [
  { id: "all", label: "Wszystkie" },
  { id: "latest", label: "Ostatnio dodane" },
  { id: "galleries", label: "Galerie" },
] as const;

const displays = [
  { id: "grid", label: "Siatka" },
  { id: "map", label: "Mapa" },
  { id: "timeline", label: "Oś czasu" },
] as const;

export function PublicChrome({
  bundle,
  query,
  formPath,
  showViews,
  authorLabel,
  children,
}: {
  bundle: Bundle;
  query: PublicQuery;
  formPath: string;
  showViews: boolean;
  authorLabel?: string;
  children: React.ReactNode;
}) {
  const eventPath = `/${bundle.event.slug}`;
  const classNames = [
    ...new Set(
      bundle.classes
        .filter((row) => !query.competition || row.competitionSlug === query.competition)
        .map((row) => row.className),
    ),
  ].sort((a, b) => a.localeCompare(b, "pl"));
  const carOptions = [
    ...new Map(
      bundle.cars
        .filter((row) => !query.competition || row.competitionSlug === query.competition)
        .map((row) => [row.slug, row.name] as const),
    ),
  ];
  const activeCar = bundle.cars.find((row) => row.slug === query.car)?.name;
  const crews = bundle.crews.filter((row) => !query.competition || row.competitionSlug === query.competition);
  return (
    <div>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 py-6">
          <div>
            <p className="text-sm text-muted">{bundle.seriesName}</p>
            <h1 className="font-display text-4xl tracking-tight md:text-5xl">{bundle.event.name}</h1>
          </div>
          <Link href="/login" className="text-sm text-muted underline-offset-4 hover:underline">
            Edycja
          </Link>
        </div>
        {bundle.siblings.length > 1 ? (
          <nav className="mx-auto flex max-w-6xl gap-3 overflow-x-auto px-4 pb-4 text-sm">
            {bundle.siblings.map((event) => (
              <Link
                key={event.slug}
                href={`/${event.slug}`}
                className={event.slug === bundle.event.slug ? "text-accent" : "text-muted"}
              >
                {event.name}
              </Link>
            ))}
          </nav>
        ) : null}
        {bundle.competitions.length > 0 ? (
          <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-4 text-sm">
            <Link
              href={withQuery(formPath, query, { competition: undefined, className: undefined, car: undefined, photo: undefined })}
              className={`rounded-full px-3 py-1 ${query.competition ? "text-muted" : "bg-ink text-paper"}`}
            >
              Cała impreza
            </Link>
            {bundle.competitions.map((competition) => (
              <Link
                key={competition.slug}
                href={withQuery(formPath, query, { competition: competition.slug, className: undefined, car: undefined, photo: undefined })}
                className={`rounded-full px-3 py-1 ${query.competition === competition.slug ? "bg-ink text-paper" : "text-muted"}`}
              >
                {competition.name}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        {showViews ? (
          <div className="flex flex-wrap gap-2">
            {views.map((view) => (
              <Link
                key={view.id}
                href={withQuery(eventPath, query, { view: view.id, photo: undefined })}
                className={`rounded-full px-4 py-2 text-sm ${query.view === view.id ? "bg-ink text-paper" : "bg-panel text-ink"}`}
              >
                {view.label}
              </Link>
            ))}
          </div>
        ) : (
          <Link href={withQuery(eventPath, query, { view: "all", photo: undefined })} className="text-sm text-muted">
            ← Wszystkie zdjęcia rajdu
          </Link>
        )}
        <form action={formPath} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {query.view !== "all" ? <input type="hidden" name="view" value={query.view} /> : null}
          {query.display !== "grid" ? <input type="hidden" name="display" value={query.display} /> : null}
          {query.author ? <input type="hidden" name="author" value={query.author} /> : null}
          {query.competition ? <input type="hidden" name="typ" value={query.competition} /> : null}
          <input className={inputClass} name="q" defaultValue={query.q ?? ""} placeholder="Numer, kierowca albo pilot" />
          <select className={inputClass} name="crew" defaultValue={query.crew ?? ""}>
            <option value="">Wszyscy zawodnicy</option>
            <option value={spectatorsCrew}>Kibice</option>
            {crews.map((crew) => (
              <option key={crew.startNumber} value={String(crew.startNumber)}>
                {crew.startNumber} {crew.driverName}
              </option>
            ))}
          </select>
          <select className={inputClass} name="stage" defaultValue={query.stage ?? ""}>
            <option value="">Wszystkie miejsca</option>
            {bundle.stages.map((stage) => (
              <option key={stage.slug} value={stage.slug}>
                {stage.code} {stage.name}
              </option>
            ))}
          </select>
          <select className={inputClass} name="klasa" defaultValue={query.className ?? ""}>
            <option value="">Wszystkie klasy</option>
            {classNames.map((className) => (
              <option key={className} value={className}>
                {className}
              </option>
            ))}
          </select>
          <select className={inputClass} name="auto" defaultValue={query.car ?? ""}>
            <option value="">Wszystkie auta</option>
            {carOptions.map(([slug, name]) => (
              <option key={slug} value={slug}>
                {name}
              </option>
            ))}
          </select>
          {query.view === "all" ? (
            <select className={inputClass} name="sort" defaultValue={query.sort}>
              <option value="time">Czas wykonania</option>
              <option value="stage">Miejsce</option>
              <option value="crew">Numer załogi</option>
              <option value="author">Fotograf</option>
            </select>
          ) : (
            <input type="hidden" name="sort" value={query.sort} />
          )}
          <button className="h-10 rounded-md bg-ink px-4 text-sm text-paper" type="submit">
            Szukaj
          </button>
        </form>
        <div className="flex flex-wrap gap-2 text-sm">
          {authorLabel ? (
            <Link className="rounded-full bg-panel px-3 py-1" href={withQuery(formPath, query, { author: undefined, photo: undefined })}>
              Autor: {authorLabel} ×
            </Link>
          ) : null}
          {query.crew ? (
            <Link className="rounded-full bg-panel px-3 py-1" href={withQuery(formPath, query, { crew: undefined, photo: undefined })}>
              {query.crew === spectatorsCrew ? "Kibice" : `Załoga ${query.crew}`} ×
            </Link>
          ) : null}
          {query.car ? (
            <Link className="rounded-full bg-panel px-3 py-1" href={withQuery(formPath, query, { car: undefined, photo: undefined })}>
              Auto: {activeCar ?? query.car} ×
            </Link>
          ) : null}
        </div>
        {query.view !== "galleries" ? (
          <div className="flex gap-2 text-sm">
            {displays.map((item) => (
              <Link
                key={item.id}
                href={withQuery(formPath, query, { display: item.id, photo: undefined })}
                className={query.display === item.id ? "text-accent" : "text-muted"}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
