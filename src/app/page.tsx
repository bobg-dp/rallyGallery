import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { getHomeEvent } from "@/lib/gallery-data";
import Link from "next/link";

async function HomeRedirect() {
  await connection();
  const event = await getHomeEvent();
  if (!event) {
    return (
      <div className="flex min-h-screen flex-col">
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6">
          <p className="text-sm text-muted">Galeria rajdowa</p>
          <h1 className="mt-2 font-display text-5xl">Jeszcze bez rajdu</h1>
          <p className="mt-4 text-muted">Administrator zakłada cykl i rajd, potem edytorzy wgrywają zdjęcia.</p>
          <Link href="/login" className="mt-6 text-sm underline decoration-accent underline-offset-4">
            Wejście dla edycji
          </Link>
        </main>
        <SiteFooter track />
      </div>
    );
  }
  redirect(`/${event.slug}`);
}

export default function Home() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Wczytuję rajd…</p>}>
      <HomeRedirect />
    </Suspense>
  );
}
