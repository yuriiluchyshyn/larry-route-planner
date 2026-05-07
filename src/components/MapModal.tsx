import { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface MapModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (lat: number, lon: number) => void;
  title: string;
  initialLat?: number;
  initialLon?: number;
}

function ClickHandler({ onSelect }: { onSelect: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterMap({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], 8);
  }, [map, lat, lon]);
  return null;
}

export function MapModal({
  open,
  onClose,
  onSelect,
  title,
  initialLat,
  initialLon,
}: MapModalProps) {
  const hasInitial = initialLat !== undefined && initialLon !== undefined;

  const [selected, setSelected] = useState<{ lat: number; lon: number } | null>(
    hasInitial ? { lat: initialLat, lon: initialLon } : null
  );

  // Sync state when modal opens with new initial values
  useEffect(() => {
    if (open) {
      if (hasInitial) {
        setSelected({ lat: initialLat, lon: initialLon });
      } else {
        setSelected(null);
      }
    }
  }, [open, initialLat, initialLon, hasInitial]);

  if (!open) return null;

  const handleClick = (lat: number, lon: number) => {
    setSelected({ lat, lon });
  };

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected.lat, selected.lon);
      onClose();
    }
  };

  const center: [number, number] = hasInitial
    ? [initialLat, initialLon]
    : [51.0, 15.0];

  const zoom = hasInitial ? 8 : 5;

  return (
    <div className="map-modal-overlay" onClick={onClose}>
      <div className="map-modal" onClick={(e) => e.stopPropagation()}>
        <div className="map-modal-header">
          <h3>{title}</h3>
          <button className="map-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="map-modal-hint">Click on the map to select a point</p>
        <MapContainer
          center={center}
          zoom={zoom}
          className="map-modal-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onSelect={handleClick} />
          {selected && <RecenterMap lat={selected.lat} lon={selected.lon} />}
          {selected && (
            <Marker position={[selected.lat, selected.lon]}>
              <Popup>
                {selected.lat.toFixed(5)}, {selected.lon.toFixed(5)}
              </Popup>
            </Marker>
          )}
        </MapContainer>
        <div className="map-modal-footer">
          {selected && (
            <span className="map-modal-coords">
              📍 {selected.lat.toFixed(5)}, {selected.lon.toFixed(5)}
            </span>
          )}
          <div className="map-modal-actions">
            <button className="map-modal-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              className="map-modal-confirm"
              onClick={handleConfirm}
              disabled={!selected}
            >
              ✓ Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
