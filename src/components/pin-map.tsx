"use client";

import * as maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
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

export function PinMap({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (point: { latitude: number; longitude: number }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!ref.current) return;
    maplibregl.setWorkerUrl("/maplibre-gl-worker.js");
    const map = new maplibregl.Map({
      container: ref.current,
      style,
      center: longitude != null && latitude != null ? [longitude, latitude] : [19.4, 52.1],
      zoom: longitude != null && latitude != null ? 13 : 5,
    });
    const marker = new maplibregl.Marker({ draggable: true, color: "#c2410c" });
    if (latitude != null && longitude != null) marker.setLngLat([longitude, latitude]).addTo(map);
    const place = (lng: number, lat: number) => {
      marker.setLngLat([lng, lat]).addTo(map);
      onChangeRef.current({ latitude: lat, longitude: lng });
    };
    map.on("click", (event: maplibregl.MapMouseEvent) => place(event.lngLat.lng, event.lngLat.lat));
    marker.on("dragend", () => {
      const point = marker.getLngLat();
      onChangeRef.current({ latitude: point.lat, longitude: point.lng });
    });
    return () => map.remove();
  }, [latitude, longitude]);

  return <div ref={ref} className="h-64 overflow-hidden rounded-lg border border-line" />;
}
