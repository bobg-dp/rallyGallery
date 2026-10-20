"use client";

import { useEffect, useState } from "react";
import { GUEST_ID, guestLabel } from "@/lib/guest-label";

const storageKey = "rg_guest";

function guestId() {
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing && GUEST_ID.test(existing)) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(storageKey, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export function GuestCount({ initial }: { initial: number }) {
  const [guests, setGuests] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/visits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: guestId() }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { guests?: number } | null) => {
        if (!cancelled && typeof data?.guests === "number") setGuests(data.guests);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return <p>{guestLabel(guests)}</p>;
}
