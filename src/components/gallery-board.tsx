import Image from "next/image";
import Link from "next/link";
import type { GalleryCard } from "@/lib/gallery-data";
import { withQuery, type PublicQuery } from "@/lib/query";

export function GalleryBoard({
  eventSlug,
  query,
  featured,
  inne,
}: {
  eventSlug: string;
  query: PublicQuery;
  featured: GalleryCard[];
  inne: { count: number; coverUrl: string | null } | null;
}) {
  if (!featured.length && !inne) {
    return <p className="text-muted">Nie ma jeszcze opublikowanych galerii.</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {featured.map((gallery) => (
        <article key={gallery.slug} className="overflow-hidden rounded-xl border border-line bg-panel">
          <Link href={withQuery(`/${eventSlug}/g/${gallery.slug}`, query, { view: "all", photo: undefined })} className="block">
            <div className="relative aspect-[3/2] bg-line">
              {gallery.coverUrl ? (
                <Image src={gallery.coverUrl} alt="" fill unoptimized className="object-cover" sizes="30vw" />
              ) : null}
            </div>
            <div className="space-y-1 p-4">
              <h3 className="font-display text-2xl">{gallery.title || gallery.authorName}</h3>
              {gallery.title ? <p className="text-sm text-muted">{gallery.authorName}</p> : null}
              <p className="text-sm text-muted">{gallery.count} zdjęć</p>
            </div>
          </Link>
          {gallery.websiteUrl && gallery.websiteLabel ? (
            <div className="px-4 pb-4">
              <a className="text-sm underline decoration-accent underline-offset-4" href={gallery.websiteUrl} target="_blank" rel="noreferrer">
                {gallery.websiteLabel}
              </a>
            </div>
          ) : null}
        </article>
      ))}
      {inne ? (
        <article className="overflow-hidden rounded-xl border border-dashed border-line bg-panel">
          <Link href={withQuery(`/${eventSlug}/inne`, query, { view: "all", photo: undefined })} className="block">
            <div className="relative aspect-[3/2] bg-line">
              {inne.coverUrl ? <Image src={inne.coverUrl} alt="" fill unoptimized className="object-cover" sizes="30vw" /> : null}
            </div>
            <div className="space-y-1 p-4">
              <h3 className="font-display text-2xl">Inne</h3>
              <p className="text-sm text-muted">{inne.count} zdjęć z mniejszych paczek</p>
            </div>
          </Link>
        </article>
      ) : null}
    </div>
  );
}
