export function readCoordinatePair(latitudeRaw: string, longitudeRaw: string) {
  const latitudeText = latitudeRaw.trim();
  const longitudeText = longitudeRaw.trim();
  if (!latitudeText && !longitudeText) return { ok: true as const, latitude: null, longitude: null };
  if (!latitudeText || !longitudeText) return { ok: false as const, error: "Podaj szerokość i długość." };
  const latitude = Number(latitudeText.replace(",", "."));
  const longitude = Number(longitudeText.replace(",", "."));
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { ok: false as const, error: "Szerokość musi być między -90 a 90." };
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false as const, error: "Długość musi być między -180 a 180." };
  }
  return { ok: true as const, latitude, longitude };
}

export function formatCoordinate(value: number | null) {
  if (value == null) return "";
  return value.toFixed(6).replace(/\.?0+$/, "").replace(".", ",");
}
