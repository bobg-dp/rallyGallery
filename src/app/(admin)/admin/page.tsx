import Link from "next/link";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { authors, events, galleries, photos, series, users } from "@/db/schema";

export default async function Page() {
  const db = getDb();
  const [userCount, seriesCount, eventCount, authorCount, galleryCount, photoCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(users),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(series),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(events),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(authors),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(galleries),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(photos),
  ]);
  const cards = [
    ["Konta", userCount[0]?.count ?? 0, "/admin/uzytkownicy"],
    ["Cykle", seriesCount[0]?.count ?? 0, "/admin/cykle"],
    ["Rajdy", eventCount[0]?.count ?? 0, "/admin/rajdy"],
    ["Autorzy", authorCount[0]?.count ?? 0, "/admin/autorzy"],
    ["Paczki", galleryCount[0]?.count ?? 0, "/studio"],
    ["Zdjęcia", photoCount[0]?.count ?? 0, "/studio"],
  ] as const;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">Administracja</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map(([label, count, href]) => (
          <Link key={label} href={href} className="rounded-xl border border-line bg-panel p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="font-display text-3xl">{count}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
