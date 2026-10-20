import type { PhotoCard } from "./gallery-data";
import { formatWarsawDay, warsawDayKey } from "./time";

export type TimelineDay = {
  key: string;
  label: string;
  stages: { key: string; label: string; photos: PhotoCard[] }[];
};

export function buildTimeline(photos: PhotoCard[]) {
  const timed = photos.filter((photo) => photo.capturedAt);
  const untimed = photos.length - timed.length;
  const days = new Map<string, TimelineDay>();

  for (const photo of [...timed].sort((a, b) => a.capturedAt!.localeCompare(b.capturedAt!))) {
    const when = new Date(photo.capturedAt!);
    const key = warsawDayKey(when);
    let day = days.get(key);
    if (!day) {
      day = { key, label: formatWarsawDay(when), stages: [] };
      days.set(key, day);
    }
    const stageKey = photo.stageSlug ?? "brak";
    let stage = day.stages.find((item) => item.key === stageKey);
    if (!stage) {
      stage = {
        key: stageKey,
        label: photo.stageCode ? `${photo.stageCode} ${photo.stageName ?? ""}`.trim() : "Bez odcinka",
        photos: [],
      };
      day.stages.push(stage);
    }
    stage.photos.push(photo);
  }

  for (const day of days.values()) {
    day.stages.sort((a, b) => {
      if (a.key === "brak") return 1;
      if (b.key === "brak") return -1;
      const aPos = a.photos[0]?.stagePosition ?? 0;
      const bPos = b.photos[0]?.stagePosition ?? 0;
      return aPos - bPos;
    });
  }

  return { days: [...days.values()], untimed };
}
