"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

const storageKey = (pathname: string) => `gallery-y:${pathname}`;

export function RememberGalleryScroll() {
  useEffect(() => {
    const key = storageKey(window.location.pathname);
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const saved = Number(sessionStorage.getItem(key) || 0);
    if ((nav?.type === "reload" || nav?.type === "back_forward") && saved > 40) {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, saved);
    }
    document.documentElement.style.visibility = "";
    let y = window.scrollY;
    let timer = 0;
    const onScroll = () => {
      y = window.scrollY;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => sessionStorage.setItem(key, String(Math.round(y))), 120);
    };
    const onHide = () => {
      window.clearTimeout(timer);
      sessionStorage.setItem(key, String(Math.round(y)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onHide);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);
  return null;
}

export function GallerySearchForm({ action, children }: { action: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <form
      action={action}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const params = new URLSearchParams();
        for (const [key, value] of data.entries()) {
          if (typeof value !== "string") continue;
          const trimmed = value.trim();
          if (!trimmed) continue;
          if (key === "sort" && trimmed === "stage") continue;
          if (key === "view" && trimmed === "all") continue;
          if (key === "display" && trimmed === "grid") continue;
          params.set(key, trimmed);
        }
        const query = params.toString();
        const next = query ? `${action}?${query}` : action;
        const current = `${window.location.pathname}${window.location.search}`;
        if (next === current) router.refresh();
        else router.push(next, { scroll: false });
      }}
    >
      {children}
    </form>
  );
}
