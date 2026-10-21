export type RoutePosition = [number, number];

export type RouteGeometry =
  | { type: "Point"; coordinates: RoutePosition }
  | { type: "LineString"; coordinates: RoutePosition[] }
  | { type: "Polygon"; coordinates: RoutePosition[][] };

export type RouteFeature = {
  type: "Feature";
  geometry: RouteGeometry;
  properties: {
    folder: string;
    name: string;
    stageId: string | null;
  };
};

export type RouteMap = {
  type: "FeatureCollection";
  features: RouteFeature[];
};

export type RouteFolder = {
  name: string;
  stageId: string | null;
  lines: number;
  points: number;
  polygons: number;
};

type StageHint = { id: string; code: string; name: string };

export function asRouteMap(value: unknown): RouteMap | null {
  if (!value || typeof value !== "object") return null;
  const features = (value as { features?: unknown }).features;
  if (!Array.isArray(features)) return null;
  return value as RouteMap;
}

export function readMyMapsId(raw: string) {
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.toLocaleLowerCase("en");
    const google = host === "google.com" || host.endsWith(".google.com") || host === "google.pl" || host.endsWith(".google.pl");
    if (!google || !url.pathname.includes("/maps/d")) return null;
    const mid = url.searchParams.get("mid")?.trim() ?? "";
    if (!/^[A-Za-z0-9_-]{8,}$/.test(mid)) return null;
    return mid;
  } catch {
    return null;
  }
}

export async function downloadMyMapsKml(mid: string) {
  const response = await fetch(`https://www.google.com/maps/d/kml?mid=${encodeURIComponent(mid)}&forcekml=1`, {
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
    headers: {
      accept: "application/vnd.google-earth.kml+xml, application/xml, text/xml, */*",
      "user-agent": "Mozilla/5.0",
    },
  });
  if (!response.ok) throw new Error("Nie udało się pobrać mapy. Udostępnij ją linkiem i spróbuj ponownie.");
  const host = new URL(response.url).hostname.toLocaleLowerCase("en");
  const allowed = host.endsWith("google.com") || host.endsWith("googleusercontent.com") || host.endsWith("gstatic.com");
  if (!allowed) throw new Error("Nie udało się pobrać mapy. Udostępnij ją linkiem i spróbuj ponownie.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 2_000_000) throw new Error("Mapa jest za duża.");
  const xml = new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
  if (!xml.includes("<kml") && !xml.includes("<Document")) {
    throw new Error("Ta mapa nie jest dostępna. Udostępnij ją linkiem i spróbuj ponownie.");
  }
  return xml;
}

export function parseKml(xml: string): { ok: true; map: RouteMap } | { ok: false; error: string } {
  const folders = extractBlocks(xml, "Folder");
  const sources = folders.length > 0 ? folders : [xml];
  const seen = new Map<string, number>();
  const features: RouteFeature[] = [];
  let positions = 0;

  for (const source of sources) {
    const placemarks = extractBlocks(source, "Placemark");
    const headEnd = source.indexOf("<Placemark");
    const rawName = folders.length > 0 ? textOf(headEnd > 0 ? source.slice(0, headEnd) : source, "name") || "Warstwa" : "Mapa";
    const count = seen.get(rawName) ?? 0;
    seen.set(rawName, count + 1);
    const folder = (count === 0 ? rawName : `${rawName} (${count + 1})`).slice(0, 200);

    for (const placemark of placemarks) {
      const geometryAt = placemark.search(/<(?:Point|LineString|Polygon|MultiGeometry)[\s>]/);
      const name = (textOf(geometryAt > 0 ? placemark.slice(0, geometryAt) : placemark, "name") || folder).slice(0, 200);
      for (const geometry of geometries(placemark)) {
        positions += positionCount(geometry);
        if (positions > 20000) return { ok: false, error: "Mapa ma za dużo punktów." };
        features.push({ type: "Feature", geometry, properties: { folder, name, stageId: null } });
        if (features.length > 80) return { ok: false, error: "Mapa ma za dużo elementów." };
      }
    }
  }

  if (features.length === 0) return { ok: false, error: "Na mapie nie ma odcinków ani punktów." };
  return { ok: true, map: { type: "FeatureCollection", features } };
}

export function assignRouteFolders(map: RouteMap, stageRows: StageHint[], previous: RouteMap | null): RouteMap {
  const stageIds = new Set(stageRows.map((stage) => stage.id));
  const kept = new Map<string, string>();
  for (const feature of previous?.features ?? []) {
    const stageId = feature.properties?.stageId;
    if (stageId && stageIds.has(stageId)) kept.set(feature.properties.folder, stageId);
  }
  const matched = new Map<string, string | null>();
  return {
    type: "FeatureCollection",
    features: map.features.map((feature) => {
      const folder = feature.properties.folder;
      if (!matched.has(folder)) matched.set(folder, kept.get(folder) ?? matchStage(folder, stageRows));
      return { ...feature, properties: { ...feature.properties, stageId: matched.get(folder) ?? null } };
    }),
  };
}

export function setFolderStage(map: RouteMap, folder: string, stageId: string | null): RouteMap {
  return {
    type: "FeatureCollection",
    features: map.features.map((feature) =>
      feature.properties.folder === folder ? { ...feature, properties: { ...feature.properties, stageId } } : feature,
    ),
  };
}

export function routeFolders(map: RouteMap | null): RouteFolder[] {
  const folders = new Map<string, RouteFolder>();
  for (const feature of map?.features ?? []) {
    const name = feature.properties?.folder || "Warstwa";
    const folder = folders.get(name) ?? { name, stageId: feature.properties?.stageId ?? null, lines: 0, points: 0, polygons: 0 };
    if (feature.geometry?.type === "LineString") folder.lines += 1;
    else if (feature.geometry?.type === "Point") folder.points += 1;
    else if (feature.geometry?.type === "Polygon") folder.polygons += 1;
    if (!folder.stageId && feature.properties?.stageId) folder.stageId = feature.properties.stageId;
    folders.set(name, folder);
  }
  return [...folders.values()];
}

function matchStage(folder: string, stageRows: StageHint[]) {
  const folderTokens = significant(folder);
  const folderFold = fold(folder);
  let winner: string | null = null;
  let winnerScore = 0;
  let tied = false;
  for (const stage of stageRows) {
    const stageFold = fold(`${stage.code} ${stage.name}`);
    const stageTokens = significant(`${stage.code} ${stage.name}`);
    let score = 0;
    if (folderFold.length > 4 && (stageFold.includes(folderFold) || folderFold.includes(stageFold))) score += 5;
    for (const token of folderTokens) {
      for (const other of stageTokens) {
        if (token === other) score += 3;
        else if (token.length > 5 && other.length > 5 && editDistance(token, other) <= 2) score += 2;
      }
    }
    if (score < 2) continue;
    if (score > winnerScore) {
      winner = stage.id;
      winnerScore = score;
      tied = false;
    } else if (score === winnerScore) tied = true;
  }
  return !tied && winnerScore >= 2 ? winner : null;
}

function significant(value: string) {
  return fold(value)
    .split(" ")
    .filter((token) => token.length > 3 && token !== "os");
}

function fold(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pl")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function editDistance(left: string, right: string) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const current = row[j];
      row[j] = left[i - 1] === right[j - 1] ? previous : Math.min(previous, row[j], row[j - 1]) + 1;
      previous = current;
    }
  }
  return row[right.length];
}

function geometries(block: string): RouteGeometry[] {
  const result: RouteGeometry[] = [];
  for (const point of extractBlocks(block, "Point")) {
    const [position] = parseCoordinates(textOf(point, "coordinates"));
    if (position) result.push({ type: "Point", coordinates: position });
  }
  for (const line of extractBlocks(block, "LineString")) {
    const coordinates = parseCoordinates(textOf(line, "coordinates"));
    if (coordinates.length >= 2) result.push({ type: "LineString", coordinates });
  }
  for (const polygon of extractBlocks(block, "Polygon")) {
    const ring = extractBlocks(polygon, "LinearRing")[0];
    const coordinates = ring ? parseCoordinates(textOf(ring, "coordinates")) : [];
    if (coordinates.length >= 4) result.push({ type: "Polygon", coordinates: [coordinates] });
  }
  return result;
}

function positionCount(geometry: RouteGeometry) {
  if (geometry.type === "Point") return 1;
  if (geometry.type === "LineString") return geometry.coordinates.length;
  return geometry.coordinates.reduce((sum, ring) => sum + ring.length, 0);
}

function parseCoordinates(raw: string): RoutePosition[] {
  const positions: RoutePosition[] = [];
  for (const token of raw.trim().split(/\s+/)) {
    if (!token) continue;
    const [lng, lat] = token.split(",");
    const longitude = Number(lng);
    const latitude = Number(lat);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) continue;
    positions.push([longitude, latitude]);
  }
  return positions;
}

function textOf(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  if (!match) return "";
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractBlocks(xml: string, tag: string) {
  const blocks: string[] = [];
  let from = 0;
  while (from < xml.length) {
    const start = findTag(xml, tag, from, false);
    if (start < 0) break;
    const startTagEnd = xml.indexOf(">", start);
    if (startTagEnd < 0) break;
    if (xml[startTagEnd - 1] === "/") {
      from = startTagEnd + 1;
      continue;
    }
    let depth = 1;
    let cursor = startTagEnd + 1;
    while (depth > 0) {
      const nextOpen = findTag(xml, tag, cursor, false);
      const nextClose = findTag(xml, tag, cursor, true);
      if (nextClose < 0) return blocks;
      if (nextOpen >= 0 && nextOpen < nextClose) {
        depth += 1;
        const nestedEnd = xml.indexOf(">", nextOpen);
        cursor = nestedEnd < 0 ? nextOpen + tag.length : nestedEnd + 1;
      } else {
        depth -= 1;
        if (depth === 0) {
          blocks.push(xml.slice(startTagEnd + 1, nextClose));
          from = nextClose + tag.length + 3;
        } else cursor = nextClose + tag.length + 3;
      }
    }
  }
  return blocks;
}

function findTag(xml: string, tag: string, from: number, closing: boolean) {
  const needle = closing ? `</${tag}>` : `<${tag}`;
  let cursor = from;
  while (cursor < xml.length) {
    const index = xml.indexOf(needle, cursor);
    if (index < 0) return -1;
    if (closing) return index;
    const next = xml[index + needle.length];
    if (next === ">" || next === " " || next === "\n" || next === "\r" || next === "\t" || next === "/") return index;
    cursor = index + needle.length;
  }
  return -1;
}
