import bcrypt from "bcryptjs";
import { and, eq, inArray, isNull } from "drizzle-orm";
import sharp from "sharp";
import { createDb, type AppDb } from "./index";
import { authors, competitions, crewEntries, events, galleries, people, photoCrews, photos, series, stages, users } from "./schema";
import { processPhoto } from "../lib/images";
import { photoKeys, writeObject } from "../lib/storage";
import { isLogin, normalizeLogin } from "../lib/login";
import { slugify, uniqueSlug } from "../lib/slug";
import { warsawLocalToDate } from "../lib/time";

async function ensureUser(db: AppDb, email: string | undefined, password: string | undefined, name: string, role: "admin" | "editor") {
  const login = normalizeLogin(email ?? "");
  if (!isLogin(login) || !password) return;
  const existing = await db.query.users.findFirst({ where: eq(users.email, login) });
  if (existing) return;
  await db.insert(users).values({
    email: login,
    name,
    role,
    passwordHash: await bcrypt.hash(password, 12),
  });
}

async function personId(db: AppDb, name: string) {
  const slug = slugify(name);
  const existing = await db.query.people.findFirst({ where: eq(people.slug, slug) });
  if (existing) return existing.id;
  const [created] = await db.insert(people).values({ name, slug }).returning();
  return created.id;
}

async function frame(label: string, width: number, height: number, from: string, to: string) {
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${from}"/>
        <stop offset="1" stop-color="${to}"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="48" y="90" fill="white" font-size="42" font-family="sans-serif">${label}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}

async function ensureDemoCompetitions(db: AppDb) {
  const event = await db.query.events.findFirst({ where: eq(events.slug, "rajd-swidnicki-2026") });
  if (!event) return;
  const specs = [
    { name: "Rajd Okręgowy", slug: "rajd-okregowy", position: 1, numbers: ["1"] },
    { name: "Rally Sprint", slug: "rally-sprint", position: 2, numbers: ["7"] },
    { name: "KJS", slug: "kjs", position: 3, numbers: ["14"] },
  ];
  for (const spec of specs) {
    let row = await db.query.competitions.findFirst({
      where: and(eq(competitions.eventId, event.id), eq(competitions.slug, spec.slug)),
    });
    if (!row) {
      const [created] = await db
        .insert(competitions)
        .values({ eventId: event.id, name: spec.name, slug: spec.slug, position: spec.position })
        .returning();
      row = created;
    }
    await db
      .update(crewEntries)
      .set({ competitionId: row.id })
      .where(and(eq(crewEntries.eventId, event.id), inArray(crewEntries.startNumber, spec.numbers), isNull(crewEntries.competitionId)));
  }
}

async function main() {
  const { db, sql } = createDb();
  try {
    await ensureUser(db, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD, "Administrator", "admin");
    await ensureUser(db, process.env.EDITOR_EMAIL, process.env.EDITOR_PASSWORD, "Edytor", "editor");
    if (process.env.SEED_DEMO !== "1") return;

    const existing = await db.query.series.findFirst({ where: eq(series.slug, "rajdowy-puchar-jesieni") });
    if (existing) {
      await ensureDemoCompetitions(db);
      return;
    }

    const admin = await db.query.users.findFirst({ where: eq(users.email, normalizeLogin(process.env.ADMIN_EMAIL ?? "")) });
    const [season] = await db.insert(series).values({ name: "Rajdowy Puchar Jesieni", slug: "rajdowy-puchar-jesieni" }).returning();
    const [event] = await db
      .insert(events)
      .values({
        seriesId: season.id,
        name: "Rajd Świdnicki 2026",
        slug: "rajd-swidnicki-2026",
        startsOn: "2026-10-17",
        endsOn: "2026-10-18",
        position: 1,
        galleryMinPhotos: 8,
      })
      .returning();

    const stageSeed = [
      { code: "OS 1", name: "Witoszów", dayNumber: 1, position: 1 },
      { code: "OS 2", name: "Zagórze", dayNumber: 1, position: 2 },
      { code: "OS 5", name: "Świdnica", dayNumber: 2, position: 3 },
    ];
    const stageRows = [];
    for (const stage of stageSeed) {
      const slug = await uniqueSlug(stage.code, async (candidate) => {
        const row = await db.query.stages.findFirst({ where: eq(stages.slug, candidate) });
        return Boolean(row);
      });
      const [created] = await db.insert(stages).values({ ...stage, eventId: event.id, slug }).returning();
      stageRows.push(created);
    }

    const crews = [
      { startNumber: "1", driver: "Jan Kowalski", codriver: "Anna Nowak", className: "RC2", car: "Toyota GR Yaris" },
      { startNumber: "7", driver: "Piotr Wójcik", codriver: "Ewa Maj", className: "RC2", car: "Škoda Fabia RS" },
      { startNumber: "14", driver: "Marek Lis", codriver: "", className: "RC4", car: "Ford Fiesta" },
    ];
    const crewRows = [];
    for (const crew of crews) {
      const driverId = await personId(db, crew.driver);
      const codriverId = crew.codriver ? await personId(db, crew.codriver) : null;
      const [created] = await db
        .insert(crewEntries)
        .values({
          eventId: event.id,
          startNumber: crew.startNumber,
          className: crew.className,
          car: crew.car,
          driverId,
          codriverId,
        })
        .returning();
      crewRows.push(created);
    }
    await ensureDemoCompetitions(db);

    const [anna] = await db
      .insert(authors)
      .values({
        name: "Anna Lis",
        slug: "anna-lis",
        websiteUrl: "https://facebook.com/annalis.foto",
        websiteLabel: "Facebook",
      })
      .returning();
    const [bartek] = await db
      .insert(authors)
      .values({
        name: "Bartek Noc",
        slug: "bartek-noc",
        websiteUrl: "https://bartek.example",
        websiteLabel: "Portfolio",
      })
      .returning();
    const [mainGallery] = await db
      .insert(galleries)
      .values({ eventId: event.id, authorId: anna.id, title: "Sobota na OS-ach", slug: "sobota-na-os-ach", createdById: admin?.id })
      .returning();
    const [smallGallery] = await db
      .insert(galleries)
      .values({ eventId: event.id, authorId: bartek.id, title: null, slug: "bartek-noc", createdById: admin?.id })
      .returning();

    const shots = [
      { gallery: mainGallery.id, label: "OS1 / 1", stage: 0, crew: 0, at: "2026-10-17T09:12", lat: 50.843, lng: 16.475, w: 1600, h: 1066, from: "#8c3a1e", to: "#1c3b32" },
      { gallery: mainGallery.id, label: "OS1 / 7", stage: 0, crew: 1, at: "2026-10-17T09:18", lat: 50.844, lng: 16.478, w: 1400, h: 1600, from: "#24527a", to: "#c2410c" },
      { gallery: mainGallery.id, label: "OS1 / 14", stage: 0, crew: 2, at: "2026-10-17T09:26", lat: 50.846, lng: 16.481, w: 1800, h: 1000, from: "#3d3428", to: "#d7a15a" },
      { gallery: mainGallery.id, label: "OS2 / 1", stage: 1, crew: 0, at: "2026-10-17T11:04", lat: 50.851, lng: 16.502, w: 1600, h: 1200, from: "#1c3b32", to: "#6e8b74" },
      { gallery: mainGallery.id, label: "OS2 / 7", stage: 1, crew: 1, at: "2026-10-17T11:11", lat: 50.853, lng: 16.508, w: 1500, h: 1000, from: "#5c2d3a", to: "#e7d7c4" },
      { gallery: mainGallery.id, label: "OS2 publiczność", stage: 1, crew: null, at: "2026-10-17T11:20", lat: null, lng: null, w: 1600, h: 900, from: "#2b2a28", to: "#8d8478" },
      { gallery: mainGallery.id, label: "OS5 / 1", stage: 2, crew: 0, at: "2026-10-18T10:02", lat: 50.84, lng: 16.49, w: 1700, h: 1100, from: "#12343f", to: "#e07a3d" },
      { gallery: mainGallery.id, label: "OS5 / 7", stage: 2, crew: 1, at: "2026-10-18T10:09", lat: 50.841, lng: 16.494, w: 1200, h: 1600, from: "#6b2d1a", to: "#f3eee4" },
      { gallery: mainGallery.id, label: "Meta", stage: 2, crew: 2, at: null, lat: 50.842, lng: 16.491, w: 1600, h: 1066, from: "#22201c", to: "#c2410c" },
      { gallery: smallGallery.id, label: "Serwis 1", stage: null, crew: 0, at: "2026-10-17T13:40", lat: 50.846, lng: 16.488, w: 1500, h: 1000, from: "#314e43", to: "#c9b59a" },
      { gallery: smallGallery.id, label: "Serwis 7", stage: null, crew: 1, at: "2026-10-17T13:55", lat: null, lng: null, w: 1400, h: 1400, from: "#4a3428", to: "#8aa0b2" },
      { gallery: smallGallery.id, label: "Ceremonia", stage: null, crew: null, at: "2026-10-18T16:10", lat: 50.8436, lng: 16.487, w: 1800, h: 900, from: "#1a1714", to: "#a33b16" },
    ];

    for (const shot of shots) {
      const id = crypto.randomUUID();
      const jpeg = await frame(shot.label, shot.w, shot.h, shot.from, shot.to);
      const processed = await processPhoto(jpeg);
      const keys = photoKeys(id);
      await writeObject(keys.originalKey, jpeg, "image/jpeg");
      await writeObject(keys.thumbKey, processed.thumb, "image/webp");
      await writeObject(keys.gridKey, processed.grid, "image/webp");
      await writeObject(keys.viewKey, processed.view, "image/webp");
      const publishedAt = shot.at ? warsawLocalToDate(shot.at) : new Date("2026-10-18T18:00:00Z");
      await db.insert(photos).values({
        id,
        galleryId: shot.gallery,
        stageId: shot.stage == null ? null : stageRows[shot.stage].id,
        capturedAt: shot.at ? warsawLocalToDate(shot.at) : null,
        latitude: shot.lat,
        longitude: shot.lng,
        status: "published",
        publishedAt,
        originalKey: keys.originalKey,
        thumbKey: keys.thumbKey,
        gridKey: keys.gridKey,
        viewKey: keys.viewKey,
        width: processed.width,
        height: processed.height,
        uploadedById: admin?.id,
      });
      if (shot.crew != null) {
        await db.insert(photoCrews).values({ photoId: id, crewEntryId: crewRows[shot.crew].id, position: 0 });
      }
    }
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
