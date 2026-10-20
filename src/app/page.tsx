import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getHomeEvent } from "@/lib/gallery-data";
import Link from "next/link";

async function HomeRedirect() {
  await connection();
  const event = await getHomeEvent();
  if (!event) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
        <p className="text-sm text-muted">Galeria rajdowa</p>
        <h1 className="mt-2 font-display text-5xl">Jeszcze bez rajdu</h1>
        <p className="mt-4 text-muted">Administrator zakłada cykl i rajd, potem edytorzy wgrywają zdjęcia.</p>
        <Link href="/login" className="mt-6 text-sm underline decoration-accent underline-offset-4">
          Wejście dla edycji
        </Link>
      </main>
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
