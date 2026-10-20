import Link from "next/link";
import { listStudioGalleries } from "@/lib/studio-data";
import { btnPrimary } from "@/components/styles";

export default async function Page() {
  const rows = await listStudioGalleries();
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-4xl">Biurko</h1>
        <Link className={btnPrimary} href="/studio/nowa">
          Nowa paczka
        </Link>
      </div>
      {rows.length === 0 ? <p className="text-muted">Nie ma jeszcze żadnej paczki zdjęć.</p> : null}
      <ul className="divide-y divide-line rounded-xl border border-line bg-panel">
        {rows.map((row) => (
          <li key={row.id}>
            <Link href={`/studio/${row.id}`} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
              <span>
                <span className="font-medium">{row.title || row.authorName}</span>
                <span className="ml-2 text-sm text-muted">
                  {row.authorName} · {row.eventName}
                </span>
              </span>
              <span className="text-sm text-muted">
                {row.published} opublikowanych · {row.drafts} szkiców
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
