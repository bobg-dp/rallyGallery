"use client";

import * as maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { PhotoCard } from "@/lib/gallery-data";
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

export function PhotoMap({ photos, onOpen }: { photos: PhotoCard[]; onOpen: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const photosRef = useRef(photos);
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    photosRef.current = photos;
    onOpenRef.current = onOpen;
  }, [onOpen, photos]);

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
      const data = collection(photosRef.current);
      if (data.features.length === 1) {
        const [lng, lat] = data.features[0].geometry.type === "Point" ? data.features[0].geometry.coordinates : [19.4, 52.1];
        map.setCenter([lng, lat]);
        map.setZoom(12);
      } else if (data.features.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        for (const feature of data.features) {
          if (feature.geometry.type === "Point") bounds.extend(feature.geometry.coordinates as [number, number]);
        }
        map.fitBounds(bounds, { padding: 48, maxZoom: 14 });
      }
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

  return <div ref={ref} className="h-[70vh] min-h-[420px] overflow-hidden rounded-xl border border-line" />;
}
