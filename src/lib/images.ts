import exifr from "exifr";
import sharp from "sharp";

const MAX_BYTES = 40 * 1024 * 1024;

async function readCapture(buffer: Buffer) {
  let capturedAt: Date | null = null;
  let latitude: number | null = null;
  let longitude: number | null = null;
  try {
    const exif = await exifr.parse(buffer, { reviveValues: true });
    const raw = exif?.DateTimeOriginal ?? exif?.CreateDate;
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) capturedAt = raw;
    if (typeof exif?.latitude === "number" && typeof exif?.longitude === "number") {
      if (Math.abs(exif.latitude) <= 90 && Math.abs(exif.longitude) <= 180) {
        latitude = exif.latitude;
        longitude = exif.longitude;
      }
    }
  } catch {
    capturedAt = null;
  }
  return { capturedAt, latitude, longitude };
}

export async function processJpeg(buffer: Buffer) {
  if (buffer.length > MAX_BYTES) throw new Error("Plik jest większy niż 40 MB.");
  const meta = await sharp(buffer, { failOn: "error" }).rotate().metadata();
  if (meta.format !== "jpeg" || !meta.width || !meta.height) {
    throw new Error("Tylko pliki JPEG.");
  }

  const resize = (width: number, quality: number) =>
    sharp(buffer, { failOn: "error" })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();

  const [thumb, grid, view, capture] = await Promise.all([resize(640, 72), resize(1600, 78), resize(2400, 82), readCapture(buffer)]);
  return {
    width: meta.width,
    height: meta.height,
    thumb,
    grid,
    view,
    capturedAt: capture.capturedAt,
    latitude: capture.latitude,
    longitude: capture.longitude,
  };
}
