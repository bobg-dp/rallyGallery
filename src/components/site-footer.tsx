import { GuestCount } from "./guest-count";
import { guestLabel } from "@/lib/guest-label";
import { appVersion } from "@/lib/version";
import { countGuests } from "@/lib/visitors";

export async function SiteFooter({ track = false }: { track?: boolean }) {
  let guests: number | null = null;
  try {
    guests = await countGuests();
  } catch {
    guests = null;
  }

  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 text-sm text-muted">
        <p>Wersja {appVersion()}</p>
        {guests === null ? null : track ? <GuestCount initial={guests} /> : <p>{guestLabel(guests)}</p>}
      </div>
    </footer>
  );
}
