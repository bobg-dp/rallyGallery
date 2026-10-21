import { NextRequest } from "next/server";
import { originalContentType, originalObjectKey, writeObject, type OriginalExt } from "@/lib/storage";
import { verifyUpload } from "@/lib/upload-token";

const MAX_BYTES = 40 * 1024 * 1024;

export async function PUT(request: NextRequest) {
  const photoId = request.nextUrl.searchParams.get("photoId") ?? "";
  const galleryId = request.nextUrl.searchParams.get("galleryId") ?? "";
  const exp = Number(request.nextUrl.searchParams.get("exp"));
  const sig = request.nextUrl.searchParams.get("sig") ?? "";
  if (!verifyUpload(photoId, galleryId, exp, sig)) {
    return Response.json({ error: "Wgrywanie wygasło." }, { status: 400 });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) return Response.json({ error: "Plik jest większy niż 40 MB." }, { status: 413 });
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length > MAX_BYTES) return Response.json({ error: "Plik jest większy niż 40 MB." }, { status: 413 });
  const ext: OriginalExt = request.nextUrl.searchParams.get("ext") === "webp" ? "webp" : "jpg";
  await writeObject(originalObjectKey(photoId, ext), body, originalContentType(ext));
  return new Response(null, { status: 204 });
}
