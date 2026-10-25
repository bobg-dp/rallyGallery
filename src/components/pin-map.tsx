"use client";

import * as maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
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

function routeCollection(routes: RouteMap | null): GeoJSON.FeatureCollection {
  return routes ?? { type: "FeatureCollection", features: [] };
}

function paintFor(stageId: string) {
  const chosen = stageId.length > 0;
  const lineColor: maplibregl.ExpressionSpecification | string = chosen
    ? ["case", ["==", ["get", "stageId"], stageId], "#1e3a5f", "#94a3b8"]
    : "#1e3a5f";
  const lineWidth: maplibregl.ExpressionSpecification | number = chosen
    ? ["case", ["==", ["get", "stageId"], stageId], 4, 2]
    : 3;
  const circleColor: maplibregl.ExpressionSpecification | string = chosen
    ? ["case", ["==", ["get", "stageId"], stageId], "#1e3a5f", "#94a3b8"]
    : "#1e3a5f";
  const fillOpacity: maplibregl.ExpressionSpecification | number = chosen
    ? ["case", ["==", ["get", "stageId"], stageId], 0.22, 0.08]
    : 0.16;
  return { lineColor, lineWidth, circleColor, fillOpacity };
}

function applyRoutePaint(map: maplibregl.Map, stageId: string) {
  if (!map.getLayer("routes-line")) return;
  const paint = paintFor(stageId);
  map.setPaintProperty("routes-line", "line-color", paint.lineColor);
  map.setPaintProperty("routes-line", "line-width", paint.lineWidth);
  map.setPaintProperty("routes-points", "circle-color", paint.circleColor);
  map.setPaintProperty("routes-fill", "fill-opacity", paint.fillOpacity);
}

function fitRoutes(map: maplibregl.Map, routes: RouteMap | null) {
  const bounds = new maplibregl.LngLatBounds();
  let count = 0;
  const extend = (position: [number, number]) => {
    bounds.extend(position);
    count += 1;
  };
  for (const feature of routes?.features ?? []) {
    extendGeometry(extend, feature.geometry);
  }
  if (count > 1) map.fitBounds(bounds, { padding: 28, maxZoom: 13 });
  else if (count === 1) {
    map.setCenter(bounds.getCenter());
    map.setZoom(13);
  }
}

function extendGeometry(extend: (position: [number, number]) => void, geometry: RouteMap["features"][number]["geometry"]) {
  if (geometry.type === "Point") extend(geometry.coordinates);
  else if (geometry.type === "LineString") geometry.coordinates.forEach(extend);
  else geometry.coordinates.forEach((ring) => ring.forEach(extend));
}

function fitPlace(
  map: maplibregl.Map,
  routes: RouteMap | null,
  stageId: string,
  pin: { latitude: number | null; longitude: number | null },
) {
  const course = new maplibregl.LngLatBounds();
  const spots = new maplibregl.LngLatBounds();
  let courseCount = 0;
  let spotCount = 0;
  for (const feature of routes?.features ?? []) {
    if (feature.properties.stageId !== stageId) continue;
    if (feature.geometry.type === "Point") {
      spots.extend(feature.geometry.coordinates);
      spotCount += 1;
      continue;
    }
    extendGeometry((position) => {
      course.extend(position);
      courseCount += 1;
    }, feature.geometry);
  }
  if (courseCount > 1) {
    if (spotCount > 0) course.extend(spots);
    map.fitBounds(course, { padding: 32, maxZoom: 15, duration: 600 });
    return;
  }
  if (pin.longitude != null && pin.latitude != null) {
    map.easeTo({ center: [pin.longitude, pin.latitude], zoom: 14, duration: 600 });
    return;
  }
  if (spotCount > 1) {
    map.fitBounds(spots, { padding: 32, maxZoom: 14, duration: 600 });
    return;
  }
  if (spotCount === 1) map.easeTo({ center: spots.getCenter(), zoom: 14, duration: 600 });
}

export function PinMap({
  latitude,
  longitude,
  routes = null,
  stageId = "",
  focusPin = 0,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  routes?: RouteMap | null;
  stageId?: string;
  focusPin?: number;
  onChange: (point: { latitude: number; longitude: number }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const routesRef = useRef(routes);
  const stageIdRef = useRef(stageId);
  const pointRef = useRef({ latitude, longitude });
  useEffect(() => {
    onChangeRef.current = onChange;
    routesRef.current = routes;
    stageIdRef.current = stageId;
    pointRef.current = { latitude, longitude };
  }, [latitude, longitude, onChange, routes, stageId]);

  useEffect(() => {
    if (!ref.current) return;
    maplibregl.setWorkerUrl("/maplibre-gl-worker.js");
    const start = pointRef.current;
    const latitude = start.latitude;
    const longitude = start.longitude;
    const placed = longitude != null && latitude != null;
    const map = new maplibregl.Map({
      container: ref.current,
      style,
      center: placed ? [longitude, latitude] : [19.4, 52.1],
      zoom: placed ? 13 : 5,
    });
    mapRef.current = map;
    const marker = new maplibregl.Marker({ draggable: true, color: "#f76003" });
    markerRef.current = marker;
    if (placed) marker.setLngLat([longitude, latitude]).addTo(map);
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
      applyRoutePaint(map, stageIdRef.current);
      const current = pointRef.current;
      if (stageIdRef.current) fitPlace(map, routesRef.current, stageIdRef.current, current);
      else if (current.latitude == null || current.longitude == null) fitRoutes(map, routesRef.current);
    });
    map.on("click", (event: maplibregl.MapMouseEvent) => {
      marker.setLngLat([event.lngLat.lng, event.lngLat.lat]).addTo(map);
      onChangeRef.current({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
    });
    marker.on("dragend", () => {
      const point = marker.getLngLat();
      onChangeRef.current({ latitude: point.lat, longitude: point.lng });
    });
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    if (latitude == null || longitude == null) {
      marker.remove();
      if (map.isStyleLoaded()) {
        if (stageIdRef.current) fitPlace(map, routesRef.current, stageIdRef.current, { latitude: null, longitude: null });
        else fitRoutes(map, routesRef.current);
      }
      return;
    }
    marker.setLngLat([longitude, latitude]).addTo(map);
  }, [latitude, longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    applyRoutePaint(map, stageId);
    if (!stageId) return;
    fitPlace(map, routesRef.current, stageId, pointRef.current);
  }, [stageId, focusPin]);

  return <div ref={ref} className="h-80 overflow-hidden rounded-lg border border-line" />;
}
