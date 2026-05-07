import { useMemo, useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-polylinedecorator';
import type { OptimizedRoute, WayPoint, FreightOffer, RouteSegment } from '../types';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom colored markers
const createIcon = (color: string, label: string) =>
  L.divIcon({
    className: 'route-map-marker',
    html: `<div style="background:${color};color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

const homeIcon = L.divIcon({
  className: 'route-map-marker',
  html: `<div style="background:#2c3e50;color:#fff;border-radius:6px;padding:4px 8px;font-weight:700;font-size:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);white-space:nowrap;">🏠 HOME</div>`,
  iconSize: [70, 28],
  iconAnchor: [35, 14],
});

interface RouteMapModalProps {
  open: boolean;
  onClose: () => void;
  route: OptimizedRoute;
  routeIndex: number;
  homeBase: WayPoint;
}

interface LoadPoint {
  lat: number;
  lon: number;
  city: string;
}

type MapType = 'osm' | 'satellite' | 'topo';

interface MapTypeConfig {
  name: string;
  url: string;
  attribution: string;
  icon: string;
}

const MAP_TYPES: Record<MapType, MapTypeConfig> = {
  osm: {
    name: 'Стандартна',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    icon: '🗺️'
  },
  satellite: {
    name: 'Супутник',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
    icon: '🛰️'
  },
  topo: {
    name: 'Топографічна',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a>',
    icon: '🏔️'
  }
};

// Component for polyline with arrow markers
function ArrowPolyline({ 
  positions, 
  color, 
  isDashed = false,
  isHighlighted = false,
  onClick,
  children 
}: { 
  positions: [number, number][], 
  color: string, 
  isDashed?: boolean,
  isHighlighted?: boolean,
  onClick?: () => void,
  children?: React.ReactNode 
}) {
  const map = useMap();
  
  useEffect(() => {
    if (positions.length < 2) return;
    
    // Create multiple small arrows along the line
    const markers: L.Marker[] = [];
    const distance = getDistance(positions[0], positions[positions.length - 1]);
    const numArrows = Math.max(1, Math.min(5, Math.ceil(distance / 200))); // 1-5 arrows, every ~200km
    
    for (let i = 1; i <= numArrows; i++) {
      const t = i / (numArrows + 1); // distribute evenly along the line
      const point = interpolatePoint(positions[0], positions[positions.length - 1], t);
      const angle = getAngle(positions[0], positions[positions.length - 1]);
      
      const arrowIcon = L.divIcon({
        html: `<div style="
          color: #000; 
          font-size: 16px; 
          font-weight: bold;
          opacity: 0.8;
          transform: rotate(${angle}deg);
          line-height: 1;
          text-shadow: 1px 1px 2px rgba(255,255,255,0.9);
        ">⇒</div>`,
        className: 'arrow-marker-small',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      
      const marker = L.marker(point, { icon: arrowIcon, interactive: false }).addTo(map);
      markers.push(marker);
    }
    
    return () => {
      markers.forEach(m => {
        try {
          map.removeLayer(m);
        } catch (e) {
          // Ignore errors if marker already removed
        }
      });
    };
  }, [map, positions, color, isHighlighted]);
  
  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: isHighlighted ? '#f39c12' : color,
        weight: isHighlighted ? (isDashed ? 5 : 8) : (isDashed ? 3 : 5),
        opacity: isHighlighted ? 1 : (isDashed ? 0.85 : 0.9),
        dashArray: isDashed ? '8 8' : undefined,
      }}
      eventHandlers={{
        click: onClick
      }}
    >
      {children}
    </Polyline>
  );
}

// Interpolate a point between two positions at fraction t (0-1)
function interpolatePoint(start: [number, number], end: [number, number], t: number): [number, number] {
  return [
    start[0] + (end[0] - start[0]) * t,
    start[1] + (end[1] - start[1]) * t,
  ];
}

// Approximate distance in km between two lat/lon points
function getDistance(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLon = (b[1] - a[1]) * Math.PI / 180;
  const lat1 = a[0] * Math.PI / 180;
  const lat2 = b[0] * Math.PI / 180;
  const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Calculate angle between two points for arrow rotation
function getAngle(start: [number, number], end: [number, number]): number {
  const dx = end[1] - start[1]; // longitude difference
  const dy = end[0] - start[0]; // latitude difference
  
  // Fix: swap dx and dy to get correct direction, and add 90 degrees to align with arrow symbol
  return Math.atan2(dy, dx) * (180 / Math.PI) + 90;
}

function getLoadingCoords(offer: FreightOffer): LoadPoint {
  const spot = offer.freight.spots.find((s) =>
    s.operations.some((o) => o.type === 'loading')
  );
  return {
    lat: spot?.place.coordinates.latitude ?? 0,
    lon: spot?.place.coordinates.longitude ?? 0,
    city: spot?.place.address.locality ?? 'Unknown',
  };
}

function getUnloadingCoords(offer: FreightOffer): LoadPoint {
  const spot = offer.freight.spots.find((s) =>
    s.operations.some((o) => o.type === 'unloading')
  );
  return {
    lat: spot?.place.coordinates.latitude ?? 0,
    lon: spot?.place.coordinates.longitude ?? 0,
    city: spot?.place.address.locality ?? 'Unknown',
  };
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPrice(seg: RouteSegment): string {
  const p = seg.offer.price;
  if (!p.value) return '—';
  const cur = p.currency.replace(/^\d+_/, '').toUpperCase();
  return `${p.value} ${cur}`;
}

// Component to handle map initialization and fit bounds
function MapFitBounds({ bounds }: { bounds: [[number, number], [number, number]] }) {
  const map = useMap();
  
  useEffect(() => {
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, bounds]);
  
  return null;
}

export function RouteMapModal({
  open,
  onClose,
  route,
  routeIndex,
  homeBase,
}: RouteMapModalProps) {
  const [mapType, setMapType] = useState<MapType>('osm');
  const [highlightedSegment, setHighlightedSegment] = useState<number | null>(null);

  // Build geometry: list of loaded & empty legs
  const { loadedLegs, emptyLegs, bounds, stops } = useMemo(() => {
    const loaded: { from: [number, number]; to: [number, number]; seg: RouteSegment }[] = [];
    const empty: { from: [number, number]; to: [number, number]; label: string }[] = [];
    const stopMarkers: {
      position: [number, number];
      type: 'load' | 'unload';
      label: string;
      city: string;
      date: string;
      seg: RouteSegment;
      idx: number;
    }[] = [];

    const home: [number, number] = [homeBase.latitude, homeBase.longitude];
    const allPts: [number, number][] = [home];

    // Detect cyclic route (same offer repeated)
    const isCyclic =
      route.segments.length > 1 &&
      route.segments.every((s) => s.offer.id === route.segments[0].offer.id);

    let prevEnd: [number, number] = home;

    route.segments.forEach((seg, idx) => {
      const loadPt = getLoadingCoords(seg.offer);
      const unloadPt = getUnloadingCoords(seg.offer);
      const loadPos: [number, number] = [loadPt.lat, loadPt.lon];
      const unloadPos: [number, number] = [unloadPt.lat, unloadPt.lon];

      // Empty leg before this segment:
      // - cyclic: always home -> load (we return home between cycles)
      // - chain[0]: home -> load
      // - chain[i>0]: prev.unload -> load
      const emptyFrom: [number, number] = isCyclic ? home : prevEnd;
      empty.push({
        from: emptyFrom,
        to: loadPos,
        label: `В холосту ${seg.emptyDistanceKm.toFixed(0)} км`,
      });

      // Loaded leg
      loaded.push({ from: loadPos, to: unloadPos, seg });

      // Sequential numbering: each segment gets consecutive numbers
      // Loading points: 1, 3, 5, 7... (odd numbers)
      // Unloading points: 2, 4, 6, 8... (even numbers)
      const loadNumber = idx * 2 + 1;
      const unloadNumber = idx * 2 + 2;

      // Add loading marker
      stopMarkers.push({
        position: loadPos,
        type: 'load',
        label: `${loadNumber}`,
        city: loadPt.city,
        date: seg.loadingDate,
        seg,
        idx,
      });
      
      // Add unloading marker
      stopMarkers.push({
        position: unloadPos,
        type: 'unload',
        label: `${unloadNumber}`,
        city: unloadPt.city,
        date: seg.unloadingDate,
        seg,
        idx,
      });

      allPts.push(loadPos, unloadPos);

      if (isCyclic) {
        // After each cycle we return home
        empty.push({
          from: unloadPos,
          to: home,
          label: 'В холосту до Home',
        });
        prevEnd = home;
      } else {
        prevEnd = unloadPos;
      }
    });

    // Final empty leg back to home (for chain routes only; cyclic already added)
    if (!isCyclic && route.segments.length > 0) {
      empty.push({
        from: prevEnd,
        to: home,
        label: 'Повернення додому',
      });
    }

    // Calculate bounds
    const lats = allPts.map((p) => p[0]).filter(lat => lat !== 0);
    const lons = allPts.map((p) => p[1]).filter(lon => lon !== 0);
    
    if (lats.length === 0 || lons.length === 0) {
      // Fallback to Europe bounds if no valid coordinates
      const bnds: [[number, number], [number, number]] = [
        [35, -10], // Southwest
        [70, 40]   // Northeast
      ];
      return { loadedLegs: loaded, emptyLegs: empty, bounds: bnds, stops: stopMarkers };
    }
    
    const bnds: [[number, number], [number, number]] = [
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)],
    ];

    return { loadedLegs: loaded, emptyLegs: empty, bounds: bnds, stops: stopMarkers };
  }, [route, homeBase]);

  // Check if we have valid coordinates
  const hasValidCoords = bounds && 
    bounds[0][0] !== 0 && bounds[0][1] !== 0 && 
    bounds[1][0] !== 0 && bounds[1][1] !== 0;

  if (!open) return null;

  return (
    <div className="map-modal-overlay" onClick={onClose}>
      <div
        className="map-modal route-map-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="map-modal-header">
          <h3>
            🗺 Маршрут #{routeIndex + 1} на карті
            <span className="route-map-subtitle">
              {route.loadedDistanceKm.toFixed(0)} км з вантажем · {route.emptyDistanceKm.toFixed(0)} км в холосту · {route.totalDays.toFixed(1)} днів
            </span>
          </h3>
          <button className="map-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="route-map-legend">
          <div className="legend-left">
            <span className="legend-item">
              <span className="legend-line loaded" /> З вантажем
            </span>
            <span className="legend-item">
              <span className="legend-line empty" /> В холосту
            </span>
            <span className="legend-item">
              <span className="legend-line highlighted" /> Підсвічений маршрут
            </span>
            <span className="legend-item">
              <span
                className="legend-dot"
                style={{ background: '#27ae60' }}
              />
              Завантаження (1,3,5...)
            </span>
            <span className="legend-item">
              <span
                className="legend-dot"
                style={{ background: '#c0392b' }}
              />
              Розвантаження (2,4,6...)
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ background: '#2c3e50' }} />
              Home base
            </span>
          </div>
          
          <div className="legend-right">
            <div className="legend-instruction">
              💡 Клікніть на лінію маршруту щоб підсвітити її. Чорні стрілки ⇒ показують напрямок руху.
            </div>
            <div className="map-type-controls">
              <span className="legend-label">Вид карти:</span>
              <div className="map-type-switcher">
                {(Object.keys(MAP_TYPES) as MapType[]).map((type) => (
                  <button
                    key={type}
                    className={`map-type-btn ${mapType === type ? 'active' : ''}`}
                    onClick={() => setMapType(type)}
                    title={MAP_TYPES[type].name}
                  >
                    {MAP_TYPES[type].icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {hasValidCoords ? (
          <MapContainer
            center={[
              (bounds[0][0] + bounds[1][0]) / 2,
              (bounds[0][1] + bounds[1][1]) / 2,
            ]}
            zoom={6}
            className="map-modal-map route-map"
          >
            <MapFitBounds bounds={bounds} />
            <TileLayer
              attribution={MAP_TYPES[mapType].attribution}
              url={MAP_TYPES[mapType].url}
            />

            {/* Empty legs — orange dashed */}
            {emptyLegs.map((leg, i) => (
              <ArrowPolyline
                key={`e-${i}`}
                positions={[leg.from, leg.to]}
                color="#e67e22"
                isDashed={true}
                isHighlighted={highlightedSegment === -1 - i} // Negative indices for empty legs
                onClick={() => setHighlightedSegment(highlightedSegment === -1 - i ? null : -1 - i)}
              >
                <Tooltip sticky>{leg.label}</Tooltip>
              </ArrowPolyline>
            ))}

            {/* Loaded legs — green solid */}
            {loadedLegs.map((leg, i) => (
              <ArrowPolyline
                key={`l-${i}`}
                positions={[leg.from, leg.to]}
                color="#27ae60"
                isHighlighted={highlightedSegment === i}
                onClick={() => setHighlightedSegment(highlightedSegment === i ? null : i)}
              >
                <Tooltip sticky>
                  <div style={{ fontSize: '0.8rem' }}>
                    <strong>
                      {leg.seg.from} → {leg.seg.to}
                    </strong>
                    <br />
                    📦 {leg.seg.distanceKm.toFixed(0)} км ·{' '}
                    {leg.seg.drivingHours.toFixed(1)} год
                    <br />
                    🕐 {formatDateTime(leg.seg.loadingDate)} →{' '}
                    {formatDateTime(leg.seg.unloadingDate)}
                    <br />
                    <em style={{ color: '#f39c12' }}>
                      Клікніть щоб підсвітити маршрут
                    </em>
                  </div>
                </Tooltip>
              </ArrowPolyline>
            ))}

            {/* Home base marker */}
            <Marker position={[homeBase.latitude, homeBase.longitude]} icon={homeIcon}>
              <Popup>
                <strong>🏠 Home Base</strong>
                <br />
                {homeBase.locality}
              </Popup>
            </Marker>

            {/* Stop markers */}
            {stops.map((stop, i) => (
              <Marker
                key={`s-${i}`}
                position={stop.position}
                icon={createIcon(
                  stop.type === 'load' ? '#27ae60' : '#c0392b',
                  stop.label
                )}
              >
                <Popup>
                  <div style={{ fontSize: '0.85rem', minWidth: '180px' }}>
                    <strong>
                      {stop.type === 'load' ? '📦 Завантаження' : '📥 Розвантаження'} #{stop.label}
                    </strong>
                    <div style={{ marginTop: '4px' }}>📍 {stop.city}</div>
                    <div>🕐 {formatDateTime(stop.date)}</div>
                    <div>
                      🚚 {stop.seg.from} → {stop.seg.to}
                    </div>
                    <div>📏 {stop.seg.distanceKm.toFixed(0)} км</div>
                    <div>💰 {formatPrice(stop.seg)}</div>
                    {stop.type === 'load' && stop.seg.emptyDistanceKm > 0 && (
                      <div style={{ color: '#e67e22' }}>
                        🚫 Порожній пробіг до цієї точки:{' '}
                        {stop.seg.emptyDistanceKm.toFixed(0)} км
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        ) : (
          <div 
            className="map-error"
            style={{ 
              height: '560px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              background: '#f8f9fa',
              border: '1px solid #dee2e6',
              color: '#6c757d',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ fontSize: '48px' }}>🗺️</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
                Карта недоступна
              </div>
              <div style={{ fontSize: '0.9rem' }}>
                Неможливо відобразити маршрут через відсутність координат
              </div>
            </div>
          </div>
        )}

        <div className="route-map-footer">
          <div className="route-map-stats">
            <span className="stat loaded">
              📦 З вантажем: {route.loadedDistanceKm.toFixed(0)} км
            </span>
            <span className="stat empty">
              🚫 В холосту: {route.emptyDistanceKm.toFixed(0)} км (
              {route.emptyRunPercent.toFixed(1)}%)
            </span>
            <span className="stat">📅 {route.totalDays.toFixed(1)} днів</span>
            <span className="stat">
              🚗 {route.totalDrivingHours.toFixed(1)} год за кермом
            </span>
            <span className="stat">☕ {route.mandatoryBreaks} перерв</span>
          </div>
          <button className="map-modal-cancel" onClick={onClose}>
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}
