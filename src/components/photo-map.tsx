"use client";

import * as maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { PhotoCard } from "@/lib/gallery-data";
import type { RouteMap } from "@/lib/route-map";
import "maplibre-gl/dist/maplibre-gl.css";

const style: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

function collection(photos: PhotoCard[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: photos
      .filter((photo) => photo.latitude != null && photo.longitude != null)
      .map((photo) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [photo.longitude!, photo.latitude!] },
        properties: { id: photo.id },
      })),
  };
}

function routeCollection(routes: RouteMap | null): GeoJSON.FeatureCollection {
  return routes ?? { type: "FeatureCollection", features: [] };
}

function fitMap(map: maplibregl.Map, photos: PhotoCard[], routes: RouteMap | null) {
  const bounds = new maplibregl.LngLatBounds();
  let count = 0;
  const extend = (position: [number, number]) => {
    bounds.extend(position);
    count += 1;
  };
  for (const feature of routes?.features ?? []) {
    const geometry = feature.geometry;
    if (geometry.type === "Point") extend(geometry.coordinates);
    else if (geometry.type === "LineString") geometry.coordinates.forEach(extend);
    else geometry.coordinates.forEach((ring) => ring.forEach(extend));
  }
  for (const photo of photos) {
    if (photo.latitude == null || photo.longitude == null) continue;
    extend([photo.longitude, photo.latitude]);
  }
  if (count === 1) {
    map.setCenter(bounds.getCenter());
    map.setZoom(12);
  } else if (count > 1) map.fitBounds(bounds, { padding: 48, maxZoom: 13 });
}

export function PhotoMap({
  photos,
  routes = null,
  onOpen,
}: {
  photos: PhotoCard[];
  routes?: RouteMap | null;
  onOpen: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const photosRef = useRef(photos);
  const routesRef = useRef(routes);
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    photosRef.current = photos;
    routesRef.current = routes;
    onOpenRef.current = onOpen;
  }, [onOpen, photos, routes]);

  useEffect(() => {
    if (!ref.current) return;
    maplibregl.setWorkerUrl("/maplibre-gl-worker.js");
    const map = new maplibregl.Map({
      container: ref.current,
      style,
      center: [19.4, 52.1],
      zoom: 5,
    });
    mapRef.current = map;
    map.on("load", () => {
      map.addSource("routes", { type: "geojson", data: routeCollection(routesRef.current) });
      map.addLayer({
        id: "routes-fill",
        type: "fill",
        source: "routes",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#1e3a5f", "fill-opacity": 0.16 },
      });
      map.addLayer({
        id: "routes-line",
        type: "line",
        source: "routes",
        filter: ["==", ["geometry-type"], "LineString"],
        paint: { "line-color": "#1e3a5f", "line-width": 3, "line-opacity": 0.9 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addLayer({
        id: "routes-points",
        type: "circle",
        source: "routes",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 5,
          "circle-color": "#1e3a5f",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fffdf8",
        },
      });
      map.addSource("photos", { type: "geojson", data: collection(photosRef.current) });
      map.addLayer({
        id: "photos",
        type: "circle",
        source: "photos",
        paint: {
          "circle-radius": 7,
          "circle-color": "#c2410c",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fffdf8",
        },
      });
      fitMap(map, photosRef.current, routesRef.current);
    });
    map.on("click", "photos", (event: maplibregl.MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.id;
      if (typeof id === "string") onOpenRef.current(id);
    });
    map.on("mouseenter", "photos", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "photos", () => {
      map.getCanvas().style.cursor = "";
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const source = mapRef.current?.getSource("photos") as maplibregl.GeoJSONSource | undefined;
    source?.setData(collection(photos));
  }, [photos]);

  useEffect(() => {
    const source = mapRef.current?.getSource("routes") as maplibregl.GeoJSONSource | undefined;
    source?.setData(routeCollection(routes));
  }, [routes]);

  return <div ref={ref} className="h-[70vh] min-h-[420px] overflow-hidden rounded-xl border border-line" />;
}
