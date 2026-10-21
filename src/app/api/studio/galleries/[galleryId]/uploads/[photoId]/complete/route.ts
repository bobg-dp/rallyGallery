import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { events, galleries, photos } from "@/db/schema";
import { processPhoto } from "@/lib/images";
import { getCurrentUser } from "@/lib/current-user";
import { deleteObject, originalObjectKey, photoKeys, readObject, writeObject, type OriginalExt } from "@/lib/storage";
import { verifyUpload } from "@/lib/upload-token";

const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(
  request: Request,
  context: { params: Promise<{ galleryId: string; photoId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Wymagane logowanie." }, { status: 401 });
  const { galleryId, photoId } = await context.params;
  if (!UUID.test(galleryId) || !UUID.test(photoId)) {
    return Response.json({ error: "Nie ma takiej galerii." }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as { exp?: number; sig?: string } | null;
  if (!body?.sig || !verifyUpload(photoId, galleryId, Number(body.exp), body.sig)) {
    return Response.json({ error: "Wgrywanie wygasło. Wyślij plik ponownie." }, { status: 400 });
  }

  const [existing] = await getDb().select({ id: photos.id }).from(photos).where(eq(photos.id, photoId)).limit(1);
  if (existing) return Response.json({ ok: true });

  const gallery = await getDb().query.galleries.findFirst({ where: eq(galleries.id, galleryId) });
  if (!gallery) return Response.json({ error: "Nie ma takiej galerii." }, { status: 404 });

  let uploaded: { key: string; body: Buffer };
  try {
    uploaded = await readUploadedOriginal(photoId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się odczytać pliku.";
    return Response.json({ error: message }, { status: 400 });
  }
  const keys = { ...photoKeys(photoId), originalKey: uploaded.key };
  let processed: Awaited<ReturnType<typeof processPhoto>>;
  try {
    processed = await processPhoto(uploaded.body);
    await writeObject(keys.thumbKey, processed.thumb, "image/webp");
    await writeObject(keys.gridKey, processed.grid, "image/webp");
    await writeObject(keys.viewKey, processed.view, "image/webp");
    await getDb().insert(photos).values({
      id: photoId,
      galleryId,
      status: "draft",
      originalKey: keys.originalKey,
      thumbKey: keys.thumbKey,
      gridKey: keys.gridKey,
      viewKey: keys.viewKey,
      width: processed.width,
      height: processed.height,
      capturedAt: processed.capturedAt,
      latitude: processed.latitude,
      longitude: processed.longitude,
      uploadedById: user.id,
    });
  } catch (error) {
    await deleteObject(keys.originalKey);
    await deleteObject(keys.thumbKey);
    await deleteObject(keys.gridKey);
    await deleteObject(keys.viewKey);
    const message = error instanceof Error ? error.message : "Nie udało się obrobić zdjęcia.";
    return Response.json({ error: message }, { status: 400 });
  }

  const event = await getDb().query.events.findFirst({ where: eq(events.id, gallery.eventId) });
  revalidatePath(`/studio/${galleryId}`);
  if (event) revalidatePath(`/${event.slug}`);
  return Response.json({ ok: true });
}

async function readUploadedOriginal(photoId: string) {
  const exts: OriginalExt[] = ["jpg", "webp"];
  for (const ext of exts) {
    const key = originalObjectKey(photoId, ext);
    try {
      return { key, body: await readObject(key) };
    } catch {
      continue;
    }
  }
  throw new Error("Nie udało się odczytać pliku.");
}
