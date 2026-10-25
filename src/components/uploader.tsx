"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnGhost } from "./styles";

type Item = { id: string; name: string; status: string };

function isPhotoFile(file: File) {
  return (
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    file.type === "image/webp" ||
    /\.jpe?g$/i.test(file.name) ||
    /\.png$/i.test(file.name) ||
    /\.webp$/i.test(file.name)
  );
}

function contentType(file: File) {
  if (file.type === "image/png" || /\.png$/i.test(file.name)) return "image/png";
  if (file.type === "image/webp" || /\.webp$/i.test(file.name)) return "image/webp";
  return "image/jpeg";
}

export function Uploader({ galleryId }: { galleryId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  function mark(id: string, status: string) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
  }

  async function uploadOne(file: File, id: string) {
    mark(id, "Wysyłam");
    const created = await fetch(`/api/studio/galleries/${galleryId}/uploads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filename: file.name, byteSize: file.size }),
    });
    const payload = (await created.json()) as { photoId?: string; uploadUrl?: string; exp?: number; sig?: string; error?: string };
    if (!created.ok || !payload.photoId || !payload.uploadUrl || !payload.sig) {
      throw new Error(payload.error || "Nie udało się przygotować wysyłki.");
    }
    const put = await fetch(payload.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "content-type": contentType(file) },
    });
    if (!put.ok) throw new Error("Nie udało się wysłać pliku.");
    mark(id, "Obrabiam");
    const done = await fetch(`/api/studio/galleries/${galleryId}/uploads/${payload.photoId}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ exp: payload.exp, sig: payload.sig }),
    });
    const result = (await done.json()) as { error?: string };
    if (!done.ok) throw new Error(result.error || "Nie udało się obrobić zdjęcia.");
    mark(id, "Gotowe");
  }

  async function onFiles(list: FileList | null) {
    const picked = [...(list ?? [])];
    const files = picked.filter((file) => isPhotoFile(file));
    if (!files.length) {
      if (picked.length) setItems([{ id: crypto.randomUUID(), name: picked[0].name, status: "Tylko JPEG, PNG albo WebP." }]);
      return;
    }
    const next = files.map((file) => ({ id: crypto.randomUUID(), name: file.name, status: "W kolejce" }));
    setItems(next);
    setBusy(true);
    let cursor = 0;
    const worker = async () => {
      while (cursor < files.length) {
        const index = cursor++;
        try {
          await uploadOne(files[index], next[index].id);
        } catch (error) {
          mark(next[index].id, error instanceof Error ? error.message : "Błąd");
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="space-y-3 rounded-xl border border-dashed border-line bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Zdjęcia</h2>
          <p className="text-sm text-muted">JPEG, PNG albo WebP, pojedynczo albo serią. Autor tej paczki jest już zapisany.</p>
        </div>
        <label className={btnGhost}>
          Wybierz pliki
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp"
            multiple
            disabled={busy}
            onChange={(event) => {
              void onFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {items.length ? (
        <ul className="space-y-1 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span className="truncate">{item.name}</span>
              <span className="text-muted">{item.status}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
