import { notFound } from "next/navigation";
import { EventHero } from "@/components/event-hero";
import { GalleryBoard } from "@/components/gallery-board";
import { PhotoBrowser } from "@/components/photo-browser";
import { PublicChrome } from "@/components/public-chrome";
import { getEventBundle, getEventHero, listGalleryCards, listPublishedPhotos, type PhotoScope } from "@/lib/gallery-data";
import { getDb } from "@/db";
import { authors, events } from "@/db/schema";
import { eq } from "drizzle-orm";
import { asRouteMap } from "@/lib/route-map";
import type { PublicQuery } from "@/lib/query";

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
  const mixAll = bundle.event.shufflePhotos && scope.type === "event";
  const activeQuery = mixAll && query.view === "galleries" ? { ...query, view: "all" as const } : query;
  const showCards = showViews && activeQuery.view === "galleries";
  const [photos, cards, author, hero, routeRow] = await Promise.all([
    showCards ? Promise.resolve([]) : listPublishedPhotos(bundle.event.id, activeQuery, scope, mixAll && activeQuery.view === "all"),
    showCards ? listGalleryCards(bundle.event.id, bundle.event.galleryMinPhotos, query.competition) : Promise.resolve(null),
    query.author
      ? getDb().query.authors.findFirst({ where: eq(authors.slug, query.author) })
      : Promise.resolve(null),
    showHero ? getEventHero(bundle.event.id) : Promise.resolve(null),
    query.display === "map"
      ? getDb().select({ routeMap: events.routeMap }).from(events).where(eq(events.id, bundle.event.id)).limit(1)
      : Promise.resolve([]),
  ]);
  const routes = asRouteMap(routeRow[0]?.routeMap);

  return (
    <>
      {hero ? <EventHero src={hero.src} alt={hero.alt} title={bundle.event.name} /> : null}
      <PublicChrome bundle={bundle} query={activeQuery} formPath={formPath} showViews={showViews} authorLabel={author?.name} shuffle={mixAll}>
        {intro}
        {showCards && cards ? (
          <GalleryBoard eventSlug={eventSlug} query={query} featured={cards.featured} inne={cards.inne} />
        ) : (
          <PhotoBrowser photos={photos} display={query.display} initialPhotoId={query.photo} eventSlug={eventSlug} routes={routes} />
        )}
      </PublicChrome>
    </>
  );
}
