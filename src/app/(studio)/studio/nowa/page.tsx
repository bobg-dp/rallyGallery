import Link from "next/link";
import { NewGalleryForm } from "./form";
import { listAuthors, listEventOptions } from "@/lib/studio-data";

export default async function Page() {
  const [events, authors] = await Promise.all([listEventOptions(), listAuthors()]);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl">Nowa paczka</h1>
      <p className="max-w-xl text-sm text-muted">
        Najpierw autor. Pliki pójdą na serwer dopiero po zapisaniu tej paczki.
      </p>
      {events.length === 0 ? (
        <p>
          Nie ma jeszcze rajdu.{" "}
          <Link className="underline" href="/admin/rajdy">
            Załóż go w administracji.
          </Link>
        </p>
      ) : (
        <NewGalleryForm events={events} authors={authors} />
      )}
    </div>
  );
}
