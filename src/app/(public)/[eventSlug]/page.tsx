import type { Metadata } from "next";
import { Suspense } from "react";
import { EventView } from "@/components/event-view";
import { getEventBundle, publicEventTitle } from "@/lib/gallery-data";
import { parsePublicQuery } from "@/lib/query";

export async function generateMetadata({ params }: { params: Promise<{ eventSlug: string }> }): Promise<Metadata> {
  const { eventSlug } = await params;
  const bundle = await getEventBundle(eventSlug);
  return { title: publicEventTitle(bundle?.event) };
}

async function Screen({
  params,
  searchParams,
}: {
  params: Promise<{ eventSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { eventSlug } = await params;
  const query = parsePublicQuery(await searchParams);
  return <EventView eventSlug={eventSlug} query={query} scope={{ type: "event" }} formPath={`/${eventSlug}`} showViews showHero />;
}

export default function Page(props: {
  params: Promise<{ eventSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Wczytuję zdjęcia…</p>}>
      <Screen {...props} />
    </Suspense>
  );
}
