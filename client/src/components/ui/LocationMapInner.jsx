import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

/**
 * Leaflet map with OpenStreetMap tiles and one marker (loaded on demand by
 * LocationMap). A circle marker avoids Leaflet's default marker images.
 * One-finger dragging is off on touch screens so the page still scrolls.
 */
export default function LocationMapInner({ lat, lng, label, zoom = 16 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return undefined;
    const map = L.map(ref.current, {
      center: [lat, lng],
      zoom,
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
      tap: false,
      attributionControl: true,
    });
    map.attributionControl.setPrefix(false);
    L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
    L.circleMarker([lat, lng], { radius: 10, color: '#ffffff', weight: 3, fillColor: '#15803d', fillOpacity: 1 })
      .addTo(map)
      .bindTooltip(label, { direction: 'top', offset: [0, -10] });
    return () => map.remove();
  }, [lat, lng, label, zoom]);
  return <div ref={ref} className="h-full w-full" />;
}
