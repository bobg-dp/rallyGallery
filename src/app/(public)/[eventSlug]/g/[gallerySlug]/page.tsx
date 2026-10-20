import { Suspense } from "react";
import { notFound } from "next/navigation";
import { EventView } from "@/components/event-view";
import { getPublishedGallery } from "@/lib/gallery-data";
import { parsePublicQuery } from "@/lib/query";

async function Screen({
  params,
  searchParams,
}: {
  params: Promise<{ eventSlug: string; gallerySlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { eventSlug, gallerySlug } = await params;
  const gallery = await getPublishedGallery(eventSlug, gallerySlug);
  if (!gallery) notFound();
  const query = { ...parsePublicQuery(await searchParams), view: "all" as const };
  return (
    <EventView
      eventSlug={eventSlug}
      query={query}
      scope={{ type: "gallery", slug: gallerySlug }}
      formPath={`/${eventSlug}/g/${gallerySlug}`}
      showViews={false}
      intro={
        <div className="space-y-1">
          <h2 className="font-display text-3xl">{gallery.title || gallery.authorName}</h2>
          <p className="text-sm text-muted">
            {gallery.authorName}
            {gallery.websiteUrl && gallery.websiteLabel ? (
              <>
                {" · "}
                <a className="underline decoration-accent underline-offset-4" href={gallery.websiteUrl} target="_blank" rel="noreferrer">
                  {gallery.websiteLabel}
                </a>
              </>
            ) : null}
          </p>
        </div>
      }
    />
  );
}

export default function Page(props: {
  params: Promise<{ eventSlug: string; gallerySlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Wczytuję galerię…</p>}>
      <Screen {...props} />
    </Suspense>
  );
}
