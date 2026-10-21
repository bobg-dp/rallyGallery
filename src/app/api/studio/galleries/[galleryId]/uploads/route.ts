import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { galleries } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { createOriginalUploadUrl, originalExtFromName } from "@/lib/storage";

const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(request: Request, context: { params: Promise<{ galleryId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Wymagane logowanie." }, { status: 401 });
  const { galleryId } = await context.params;
  if (!UUID.test(galleryId)) return Response.json({ error: "Nie ma takiej galerii." }, { status: 404 });
  const gallery = await getDb().query.galleries.findFirst({ where: eq(galleries.id, galleryId) });
  if (!gallery) return Response.json({ error: "Nie ma takiej galerii." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { filename?: string; byteSize?: number } | null;
  const filename = body?.filename ?? "";
  const byteSize = Number(body?.byteSize ?? 0);
  const ext = originalExtFromName(filename);
  if (!ext) return Response.json({ error: "Tylko pliki JPEG i WebP." }, { status: 400 });
  if (!Number.isFinite(byteSize) || byteSize < 1 || byteSize > 40 * 1024 * 1024) {
    return Response.json({ error: "Plik jest większy niż 40 MB." }, { status: 400 });
  }

  const photoId = crypto.randomUUID();
  const upload = await createOriginalUploadUrl(photoId, galleryId, ext);
  return Response.json({ photoId, uploadUrl: upload.url, exp: upload.exp, sig: upload.sig });
}
