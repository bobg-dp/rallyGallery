import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { authors, cars, competitions, crewEntries, events, galleries, people, photoCrews, photos, series, stages } from "@/db/schema";
import { derivativeUrl } from "./storage";
import { spectatorsCrew, type PublicQuery } from "./query";
import { startNumberOrder } from "./start-number";

const drivers = alias(people, "drivers");

export type PhotoCrew = {
  startNumber: string;
  driverName: string;
  codriverName: string | null;
  car: string;
  className: string;
  competitionName: string | null;
};

export type PhotoCard = {
  id: string;
  width: number;
  height: number;
  thumbUrl: string;
  gridUrl: string;
  viewUrl: string;
  caption: string | null;
  capturedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  stageSlug: string | null;
  stageCode: string | null;
  stageName: string | null;
  stagePosition: number | null;
  dayNumber: number | null;
  crews: PhotoCrew[];
  carName: string | null;
  carSlug: string | null;
  spectators: boolean;
  authorName: string;
  authorSlug: string;
  websiteUrl: string | null;
  websiteLabel: string | null;
  gallerySlug: string;
  galleryTitle: string | null;
};

export type GalleryCard = {
  slug: string;
  title: string | null;
  authorName: string;
  authorSlug: string;
  websiteUrl: string | null;
  websiteLabel: string | null;
  count: number;
  coverUrl: string | null;
};

export async function getEventHero(eventId: string) {
  const [row] = await getDb()
    .select({
      viewKey: photos.viewKey,
      caption: photos.caption,
      authorName: authors.name,
    })
    .from(events)
    .innerJoin(photos, eq(events.heroPhotoId, photos.id))
    .innerJoin(galleries, eq(photos.galleryId, galleries.id))
    .innerJoin(authors, eq(galleries.authorId, authors.id))
    .where(and(eq(events.id, eventId), eq(photos.status, "published")))
    .limit(1);
  if (!row) return null;
  return {
    src: derivativeUrl(row.viewKey),
    alt: row.caption || `Zdjęcie: ${row.authorName}`,
  };
}

export async function getHomeEvent() {
  const [event] = await getDb()
    .select({ slug: events.slug })
    .from(events)
    .orderBy(desc(events.startsOn), desc(events.position))
    .limit(1);
  return event ?? null;
}

export async function getEventBundle(slug: string) {
  const event = await getDb().query.events.findFirst({
    where: eq(events.slug, slug),
    with: { series: true },
    columns: { routeMap: false },
  });
  if (!event) return null;
  const [siblings, stageRows, competitionRows, crewRows, classRows] = await Promise.all([
    getDb()
      .select({ slug: events.slug, name: events.name })
      .from(events)
      .where(eq(events.seriesId, event.seriesId))
      .orderBy(asc(events.position), asc(events.startsOn)),
    getDb()
      .select({ slug: stages.slug, code: stages.code, name: stages.name })
      .from(stages)
      .where(eq(stages.eventId, event.id))
      .orderBy(asc(stages.position)),
    getDb()
      .select({ slug: competitions.slug, name: competitions.name })
      .from(competitions)
      .where(eq(competitions.eventId, event.id))
      .orderBy(asc(competitions.position), asc(competitions.name)),
    getDb()
      .select({
        startNumber: crewEntries.startNumber,
        driverName: drivers.name,
        competitionSlug: competitions.slug,
      })
      .from(crewEntries)
      .innerJoin(drivers, eq(crewEntries.driverId, drivers.id))
      .leftJoin(competitions, eq(crewEntries.competitionId, competitions.id))
      .where(eq(crewEntries.eventId, event.id))
      .orderBy(...startNumberOrder(crewEntries.startNumber)),
    getDb()
      .selectDistinct({ className: crewEntries.className, competitionSlug: competitions.slug })
      .from(crewEntries)
      .leftJoin(competitions, eq(crewEntries.competitionId, competitions.id))
      .where(eq(crewEntries.eventId, event.id))
      .orderBy(asc(crewEntries.className)),
  ]);
  return {
    event,
    seriesName: event.series.name,
    siblings,
    stages: stageRows,
    competitions: competitionRows,
    crews: crewRows,
    classes: classRows,
    cars: await getDb()
      .selectDistinct({
        slug: cars.slug,
        name: cars.name,
        competitionSlug: competitions.slug,
      })
      .from(photos)
      .innerJoin(galleries, eq(photos.galleryId, galleries.id))
      .innerJoin(cars, eq(photos.carId, cars.id))
      .leftJoin(photoCrews, eq(photoCrews.photoId, photos.id))
      .leftJoin(crewEntries, eq(photoCrews.crewEntryId, crewEntries.id))
      .leftJoin(competitions, eq(crewEntries.competitionId, competitions.id))
      .where(and(eq(galleries.eventId, event.id), eq(photos.status, "published")))
      .orderBy(asc(cars.name)),
  };
}

export type PhotoScope = { type: "event" } | { type: "gallery"; slug: string } | { type: "inne"; min: number };

function present(value: SQL | undefined): value is SQL {
  return Boolean(value);
}

export async function listPublishedPhotos(eventId: string, query: PublicQuery, scope: PhotoScope) {
  const filters: SQL[] = [eq(galleries.eventId, eventId), eq(photos.status, "published")];
  if (scope.type === "gallery") filters.push(eq(galleries.slug, scope.slug));
  if (scope.type === "inne") {
    const countedInType = query.competition
      ? sql`and exists (
          select 1 from ${photoCrews} as counted_link
          inner join ${crewEntries} as counted_crew on counted_crew.id = counted_link.crew_entry_id
          inner join ${competitions} as counted_competition on counted_competition.id = counted_crew.competition_id
          where counted_link.photo_id = counted.id and counted_competition.slug = ${query.competition}
        )`
      : sql``;
    filters.push(sql`coalesce((
      select count(*) from ${photos} as counted
      where counted.gallery_id = ${galleries.id} and counted.status = 'published' ${countedInType}
    ), 0) < ${scope.min}`);
  }
  if (query.stage) filters.push(eq(stages.slug, query.stage));
  if (query.author) filters.push(eq(authors.slug, query.author));
  if (query.car) filters.push(eq(cars.slug, query.car));
  if (query.crew === spectatorsCrew) filters.push(eq(photos.spectators, true));
  const crewMatch: SQL[] = [];
  if (query.className) crewMatch.push(eq(crewEntries.className, query.className));
  if (query.competition) crewMatch.push(eq(competitions.slug, query.competition));
  if (query.crew && query.crew !== spectatorsCrew) {
    crewMatch.push(sql`lower(${crewEntries.startNumber}) = ${query.crew.toLocaleLowerCase("pl")}`);
  }
  if (query.q) {
    const like = `%${query.q.replace(/[%_]/g, "")}%`;
    crewMatch.push(sql`(${crewEntries.startNumber} ilike ${like} or drivers.name ilike ${like} or codrivers.name ilike ${like})`);
  }
  if (crewMatch.length) {
    const crewFilter = and(...crewMatch);
    if (crewFilter) filters.push(sql`exists (
      select 1 from ${photoCrews}
      inner join ${crewEntries} on ${crewEntries.id} = ${photoCrews.crewEntryId}
      left join ${people} drivers on drivers.id = ${crewEntries.driverId}
      left join ${people} codrivers on codrivers.id = ${crewEntries.codriverId}
      left join ${competitions} on ${competitions.id} = ${crewEntries.competitionId}
      where ${photoCrews.photoId} = ${photos.id} and ${crewFilter}
    )`);
  }

  const captured = sql`${photos.capturedAt} asc nulls last`;
  const primaryNumber = sql`(
    select ${crewEntries.startNumber}
    from ${photoCrews}
    inner join ${crewEntries} on ${crewEntries.id} = ${photoCrews.crewEntryId}
    where ${photoCrews.photoId} = ${photos.id}
    order by ${photoCrews.position}
    limit 1
  )`;
  const order =
    query.view === "latest" && scope.type === "event"
      ? [desc(photos.publishedAt)]
      : query.sort === "stage"
        ? [sql`${stages.position} asc nulls last`, captured, asc(photos.createdAt)]
        : query.sort === "crew"
          ? [...startNumberOrder(primaryNumber), captured]
          : query.sort === "author"
            ? [asc(authors.name), captured]
            : [captured, asc(photos.createdAt)];

  const rows = await getDb()
    .select({
      id: photos.id,
      width: photos.width,
      height: photos.height,
      thumbKey: photos.thumbKey,
      gridKey: photos.gridKey,
      viewKey: photos.viewKey,
      caption: photos.caption,
      capturedAt: photos.capturedAt,
      latitude: photos.latitude,
      longitude: photos.longitude,
      stageSlug: stages.slug,
      stageCode: stages.code,
      stageName: stages.name,
      stagePosition: stages.position,
      dayNumber: stages.dayNumber,
      crews: sql<PhotoCrew[]>`coalesce((
        select json_agg(json_build_object(
          'startNumber', ${crewEntries.startNumber},
          'driverName', drivers.name,
          'codriverName', codrivers.name,
          'car', ${crewEntries.car},
          'className', ${crewEntries.className},
          'competitionName', ${competitions.name}
        ) order by ${photoCrews.position})
        from ${photoCrews}
        inner join ${crewEntries} on ${crewEntries.id} = ${photoCrews.crewEntryId}
        inner join ${people} drivers on drivers.id = ${crewEntries.driverId}
        left join ${people} codrivers on codrivers.id = ${crewEntries.codriverId}
        left join ${competitions} on ${competitions.id} = ${crewEntries.competitionId}
        where ${photoCrews.photoId} = ${photos.id}
      ), '[]'::json)`,
      carName: cars.name,
      carSlug: cars.slug,
      spectators: photos.spectators,
      authorName: authors.name,
      authorSlug: authors.slug,
      websiteUrl: authors.websiteUrl,
      websiteLabel: authors.websiteLabel,
      gallerySlug: galleries.slug,
      galleryTitle: galleries.title,
    })
    .from(photos)
    .innerJoin(galleries, eq(photos.galleryId, galleries.id))
    .innerJoin(authors, eq(galleries.authorId, authors.id))
    .leftJoin(stages, eq(photos.stageId, stages.id))
    .leftJoin(cars, eq(photos.carId, cars.id))
    .where(and(...filters.filter(present)))
    .orderBy(...order)
    .limit(query.view === "latest" && scope.type === "event" ? 10 : 5000);

  return rows.map((row) => ({
    id: row.id,
    width: row.width,
    height: row.height,
    thumbUrl: derivativeUrl(row.thumbKey),
    gridUrl: derivativeUrl(row.gridKey),
    viewUrl: derivativeUrl(row.viewKey),
    caption: row.caption,
    capturedAt: row.capturedAt?.toISOString() ?? null,
    latitude: row.latitude,
    longitude: row.longitude,
    stageSlug: row.stageSlug,
    stageCode: row.stageCode,
    stageName: row.stageName,
    stagePosition: row.stagePosition,
    dayNumber: row.dayNumber,
    crews: parseCrews(row.crews),
    carName: row.carName,
    carSlug: row.carSlug,
    spectators: row.spectators,
    authorName: row.authorName,
    authorSlug: row.authorSlug,
    websiteUrl: row.websiteUrl,
    websiteLabel: row.websiteLabel,
    gallerySlug: row.gallerySlug,
    galleryTitle: row.galleryTitle,
  })) satisfies PhotoCard[];
}

function parseCrews(value: unknown): PhotoCrew[] {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return Array.isArray(parsed) ? parsed : [];
}

function timeValue(value: Date | string | null) {
  if (!value) return 0;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export async function listGalleryCards(eventId: string, min: number, competitionSlug?: string) {
  const inSet = competitionSlug
    ? sql`${photos.status} = 'published' and exists (
        select 1 from ${photoCrews}
        inner join ${crewEntries} on ${crewEntries.id} = ${photoCrews.crewEntryId}
        inner join ${competitions} on ${competitions.id} = ${crewEntries.competitionId}
        where ${photoCrews.photoId} = ${photos.id} and ${competitions.slug} = ${competitionSlug}
      )`
    : sql`${photos.status} = 'published'`;
  const rows = await getDb()
    .select({
      slug: galleries.slug,
      title: galleries.title,
      authorName: authors.name,
      authorSlug: authors.slug,
      websiteUrl: authors.websiteUrl,
      websiteLabel: authors.websiteLabel,
      count: sql<number>`count(${photos.id}) filter (where ${inSet})`.mapWith(Number),
      coverKey: sql<string | null>`(array_agg(${photos.gridKey} order by ${photos.publishedAt} desc nulls last) filter (where ${inSet}))[1]`,
      latest: sql<Date | null>`max(${photos.publishedAt}) filter (where ${inSet})`,
    })
    .from(galleries)
    .innerJoin(authors, eq(galleries.authorId, authors.id))
    .leftJoin(photos, eq(photos.galleryId, galleries.id))
    .where(eq(galleries.eventId, eventId))
    .groupBy(galleries.id, authors.id);

  const featured = rows
    .filter((row) => row.count >= min)
    .sort((a, b) => timeValue(b.latest) - timeValue(a.latest))
    .map((row) => ({
      slug: row.slug,
      title: row.title,
      authorName: row.authorName,
      authorSlug: row.authorSlug,
      websiteUrl: row.websiteUrl,
      websiteLabel: row.websiteLabel,
      count: row.count,
      coverUrl: row.coverKey ? derivativeUrl(row.coverKey) : null,
    }));

  const small = rows.filter((row) => row.count > 0 && row.count < min);
  const cover = [...small].sort((a, b) => timeValue(b.latest) - timeValue(a.latest))[0];
  const inne = small.length
    ? {
        count: small.reduce((sum, row) => sum + row.count, 0),
        coverUrl: cover?.coverKey ? derivativeUrl(cover.coverKey) : null,
      }
    : null;

  return { featured, inne };
}

export async function getPublishedGallery(eventSlug: string, gallerySlug: string) {
  const [row] = await getDb()
    .select({
      galleryId: galleries.id,
      title: galleries.title,
      slug: galleries.slug,
      eventId: events.id,
      eventSlug: events.slug,
      eventName: events.name,
      seriesId: events.seriesId,
      seriesName: series.name,
      galleryMinPhotos: events.galleryMinPhotos,
      authorName: authors.name,
      authorSlug: authors.slug,
      websiteUrl: authors.websiteUrl,
      websiteLabel: authors.websiteLabel,
    })
    .from(galleries)
    .innerJoin(events, eq(galleries.eventId, events.id))
    .innerJoin(series, eq(events.seriesId, series.id))
    .innerJoin(authors, eq(galleries.authorId, authors.id))
    .where(and(eq(events.slug, eventSlug), eq(galleries.slug, gallerySlug)))
    .limit(1);
  return row ?? null;
}
