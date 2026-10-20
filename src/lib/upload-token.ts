import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return value;
}

export function signUpload(photoId: string, galleryId: string, exp: number) {
  return createHmac("sha256", secret()).update(`${photoId}.${galleryId}.${exp}`).digest("base64url");
}

export function verifyUpload(photoId: string, galleryId: string, exp: number, sig: string) {
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = signUpload(photoId, galleryId, exp);
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
