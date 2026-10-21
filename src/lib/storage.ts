import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { signUpload } from "./upload-token";

const KEY_PATTERN =
  /^(originals\/[0-9a-f-]{36}\.(?:jpg|webp)|derivatives\/[0-9a-f-]{36}\/(thumb|grid|view)\.webp)$/;

export type OriginalExt = "jpg" | "webp";

export function originalExtFromName(filename: string): OriginalExt | null {
  if (/\.webp$/i.test(filename)) return "webp";
  if (/\.jpe?g$/i.test(filename)) return "jpg";
  return null;
}

export function originalContentType(ext: OriginalExt) {
  return ext === "webp" ? "image/webp" : "image/jpeg";
}

export function originalObjectKey(photoId: string, ext: OriginalExt) {
  return `originals/${photoId}.${ext}`;
}

export function usingR2() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

function assertKey(key: string) {
  if (!KEY_PATTERN.test(key)) throw new Error("Nieprawidłowy klucz pliku.");
  return key;
}

function localPath(key: string) {
  return path.join(process.cwd(), "storage", assertKey(key));
}

function r2() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    // Domyślna suma CRC32 ląduje w podpisanym adresie. Przeglądarka robi wtedy
    // preflight, a R2 odpowiada błędem i CORS blokuje wysyłkę.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

function publicAssetBase() {
  const raw = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  if (!raw) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export function derivativeUrl(key: string) {
  const base = publicAssetBase();
  if (usingR2() && base) return `${base}/${key}`;
  return `/api/media/${key}`;
}

export async function writeObject(key: string, body: Buffer, contentType: string) {
  assertKey(key);
  if (usingR2()) {
    await r2().send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return;
  }
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

export async function readObject(key: string) {
  assertKey(key);
  if (usingR2()) {
    const result = await r2().send(
      new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }),
    );
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) throw new Error("Brak pliku.");
    return Buffer.from(bytes);
  }
  return readFile(localPath(key));
}

export async function deleteObject(key: string) {
  try {
    assertKey(key);
  } catch {
    return;
  }
  if (usingR2()) {
    await r2().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key })).catch(() => undefined);
    return;
  }
  await rm(localPath(key), { force: true });
}

export async function createOriginalUploadUrl(photoId: string, galleryId: string, ext: OriginalExt = "jpg") {
  const key = originalObjectKey(photoId, ext);
  const exp = Date.now() + 15 * 60 * 1000;
  const sig = signUpload(photoId, galleryId, exp);
  if (usingR2()) {
    const url = await getSignedUrl(
      r2(),
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: key,
        ContentType: originalContentType(ext),
      }),
      { expiresIn: 900 },
    );
    return { url, key, exp, sig };
  }
  const params = new URLSearchParams({
    photoId,
    galleryId,
    exp: String(exp),
    sig,
    ext,
  });
  return { url: `/api/storage/upload?${params.toString()}`, key, exp, sig };
}

export function photoKeys(photoId: string, ext: OriginalExt = "jpg") {
  return {
    originalKey: originalObjectKey(photoId, ext),
    thumbKey: `derivatives/${photoId}/thumb.webp`,
    gridKey: `derivatives/${photoId}/grid.webp`,
    viewKey: `derivatives/${photoId}/view.webp`,
  };
}
