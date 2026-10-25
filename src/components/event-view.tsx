import { connection } from "next/server";
import { notFound } from "next/navigation";
import { EventHero } from "@/components/event-hero";
import { GalleryBoard } from "@/components/gallery-board";
import { PhotoBrowser } from "@/components/photo-browser";
import { PublicChrome } from "@/components/public-chrome";
import { countPublishedPhotos, getEventBundle, getEventHero, listGalleryCards, listPublishedPhotos, type PhotoScope } from "@/lib/gallery-data";
import { getDb } from "@/db";
import { authors, events } from "@/db/schema";
import { eq } from "drizzle-orm";
import { asRouteMap } from "@/lib/route-map";
import { clearedFilters, type PublicQuery } from "@/lib/query";

function withoutYear(name: string) {
  const next = name.replace(/\b(?:19|20)\d{2}\b/g, " ").replace(/\s+/g, " ").trim();
  return next || name;
}

const sniezkaSocials = [
  { href: "https://www.facebook.com/people/Rally-Karkonosze/61584651251742/", label: "Facebook" },
  { href: "https://www.instagram.com/amg_rally_karkonosze", label: "Instagram" },
  { href: "https://www.youtube.com/@automobilklubkarkonosze", label: "YouTube" },
];

export async function EventView({
  eventSlug,
  query,
  scope,
  formPath,
  showViews,
  showHero,
  intro,
}: {
  eventSlug: string;
  query: PublicQuery;
  scope: PhotoScope;
  formPath: string;
  showViews: boolean;
  showHero?: boolean;
  intro?: React.ReactNode;
}) {
  const bundle = await getEventBundle(eventSlug);
  if (!bundle) notFound();
  const shuffle = bundle.event.shufflePhotos;
  const mixAll = shuffle && scope.type === "event";
  const activeQuery = query;
  const showCards = showViews && activeQuery.view === "galleries";
  const shuffleOrder = shuffle && activeQuery.view !== "latest";
  if (shuffleOrder && !showCards) await connection();
  const [photos, cards, author, hero, routeRow, photoCount] = await Promise.all([
    showCards ? Promise.resolve([]) : listPublishedPhotos(bundle.event.id, activeQuery, scope, shuffleOrder),
    showCards ? listGalleryCards(bundle.event.id, bundle.event.galleryMinPhotos, query.competition) : Promise.resolve(null),
    query.author
      ? getDb().query.authors.findFirst({ where: eq(authors.slug, query.author) })
      : Promise.resolve(null),
    showHero ? getEventHero(bundle.event.id) : Promise.resolve([]),
    query.display === "map"
      ? getDb().select({ routeMap: events.routeMap }).from(events).where(eq(events.id, bundle.event.id)).limit(1)
      : Promise.resolve([]),
    showHero ? countPublishedPhotos(bundle.event.id) : Promise.resolve(0),
  ]);
  const routes = asRouteMap(routeRow[0]?.routeMap);

  return (
    <>
      {hero.length ? (
        <EventHero
          slides={hero}
          title={withoutYear(bundle.event.name)}
          photoCount={photoCount}
          socials={bundle.event.slug === "rajd-sniezki-2026" ? sniezkaSocials : []}
        />
      ) : null}
      <PublicChrome
        bundle={bundle}
        query={activeQuery}
        formPath={formPath}
        showViews={showViews}
        authorLabel={author?.name}
        shuffle={mixAll}
        hideTitle={hero.length > 0}
      >
        {intro}
        {showCards && cards ? (
          <GalleryBoard eventSlug={eventSlug} query={query} featured={cards.featured} inne={cards.inne} />
        ) : (
          <PhotoBrowser photos={photos} display={query.display} initialPhotoId={query.photo} eventSlug={eventSlug} routes={routes} clearHref={clearedFilters(formPath, activeQuery)} />
        )}
      </PublicChrome>
    </>
  );
}
