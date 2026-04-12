import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Polyline, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { decodePolyline } from '../utils/polyline';

const containerStyle = { width: '100%', height: '100%' };

const getSafetyColor = (score) => {
  if (score >= 7) return '#22c55e';
  if (score >= 4) return '#eab308';
  return '#ef4444';
};

/**
 * CaptainMapComponent
 *
 * captainStatus:
 *   "to_pickup"  → captain heading to pickup  → shows Directions: captain → pickup
 *   "at_pickup"  → captain arrived, waiting   → shows pickup area zoomed in
 *   "on_ride"    → ride ongoing               → shows user-selected route (safest/fastest)
 *
 * Props:
 *   routesData       { fastest, safest }
 *   selectedMode     "fastest" | "safest"
 *   captainLocation  { ltd, lng }
 *   pickupLocation   string address (for Directions)
 *   captainStatus    "to_pickup" | "at_pickup" | "on_ride"
 */
const CaptainMapComponent = ({
  routesData,
  selectedMode = 'fastest',
  captainLocation,
  pickupLocation,
  captainStatus = 'to_pickup',
}) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API,
    libraries: ['places'],
  });

  const mapRef = useRef(null);
  const [userInteracted, setUserInteracted] = useState(false);
  const [directions, setDirections] = useState(null);
  const [directionsError, setDirectionsError] = useState(false);

  // ── User-selected route data ────────────────────────────────────────────────
  const selectedRoute = useMemo(
    () => routesData?.[selectedMode] || routesData?.fastest,
    [routesData, selectedMode]
  );

  const selectedPath = useMemo(() => {
    try {
      return selectedRoute?.polyline ? decodePolyline(selectedRoute.polyline) : [];
    } catch { return []; }
  }, [selectedRoute]);

  const coloredSegments = useMemo(() => {
    if (!selectedRoute?.segments) return [];
    return selectedRoute.segments.map(seg => ({
      path: decodePolyline(seg.polyline),
      color: getSafetyColor(seg.safety_score),
      isUnsafe: seg.safety_score < 4,
    }));
  }, [selectedRoute]);

  // ── Directions: captain → pickup ────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !window.google) return;
    if (captainStatus !== 'to_pickup') { setDirections(null); return; }
    if (!captainLocation?.ltd || !captainLocation?.lng || !pickupLocation) return;

    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route(
      {
        origin: { lat: captainLocation.ltd, lng: captainLocation.lng },
        destination: pickupLocation,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK') {
          setDirections(result);
          setDirectionsError(false);
        } else {
          console.error('[CaptainMap] Directions failed:', status);
          setDirectionsError(true);
        }
      }
    );
  }, [isLoaded, captainStatus, captainLocation?.ltd, captainLocation?.lng, pickupLocation]);

  // ── Auto-fit map to relevant bounds ────────────────────────────────────────
  const fitBounds = useCallback(() => {
    if (!mapRef.current || !window.google) return;
    const bounds = new window.google.maps.LatLngBounds();

    if (captainStatus === 'to_pickup' || captainStatus === 'at_pickup') {
      // Frame: captain → pickup
      if (captainLocation?.ltd) bounds.extend({ lat: captainLocation.ltd, lng: captainLocation.lng });
      if (selectedPath.length > 0) bounds.extend(selectedPath[0]); // pickup = start of route
      if (bounds.isEmpty()) return;
      mapRef.current.fitBounds(bounds, { top: 80, bottom: 160, left: 60, right: 60 });
      setTimeout(() => {
        if (mapRef.current?.getZoom() > 17) mapRef.current.setZoom(17);
      }, 200);
    } else {
      // Frame: full user-selected route
      if (selectedPath.length === 0) return;
      selectedPath.forEach(pt => bounds.extend(pt));
      if (captainLocation?.ltd) bounds.extend({ lat: captainLocation.ltd, lng: captainLocation.lng });
      mapRef.current.fitBounds(bounds, { top: 80, bottom: 200, left: 60, right: 60 });
      setTimeout(() => {
        if (mapRef.current?.getZoom() > 17) mapRef.current.setZoom(17);
      }, 200);
    }
    setUserInteracted(false);
  }, [captainStatus, captainLocation, selectedPath]);

  useEffect(() => {
    if (!userInteracted) fitBounds();
  }, [captainStatus, captainLocation, directions, selectedPath, userInteracted, fitBounds]);

  // ── Center fallback ────────────────────────────────────────────────────────
  const center = useMemo(() => {
    if (captainLocation?.ltd) return { lat: captainLocation.ltd, lng: captainLocation.lng };
    if (selectedPath.length > 0) return selectedPath[0];
    return { lat: 21.1458, lng: 79.0882 };
  }, [captainLocation, selectedPath]);

  if (!isLoaded) return <div className="w-full h-full bg-zinc-200 animate-pulse" />;

  const isSafest = selectedMode === 'safest';

  // ── Badge config per status ───────────────────────────────────────────────
  const badgeConfig = {
    to_pickup: { label: '🚗 Heading to Pickup', color: 'bg-blue-600' },
    at_pickup: { label: '📍 At Pickup — Waiting for Passenger', color: 'bg-amber-500' },
    on_ride: {
      label: isSafest ? '🛡️ SAFEST ROUTE — Ride Active' : '⚡ FASTEST ROUTE — Ride Active',
      color: isSafest ? 'bg-green-600' : 'bg-blue-600',
    },
  };
  const badge = badgeConfig[captainStatus] || badgeConfig.to_pickup;

  return (
    <div className="w-full h-full relative">
      {/* Status badge */}
      <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-1.5 rounded-full text-white text-xs font-bold shadow-lg whitespace-nowrap ${badge.color}`}>
        {badge.label}
      </div>

      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={14}
        onLoad={map => mapRef.current = map}
        onDragStart={() => setUserInteracted(true)}
        options={{ disableDefaultUI: true, gestureHandling: 'greedy', styles: MapStyles }}
      >
        {/* ── PHASE 1: Captain heading to pickup ── */}
        {captainStatus === 'to_pickup' && (
          <>
            {/* Directions route: captain → pickup */}
            {directions && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: true,
                  polylineOptions: {
                    strokeColor: '#3b82f6',
                    strokeWeight: 8,
                    strokeOpacity: 0.9,
                  },
                }}
              />
            )}
            {/* Fallback straight line if directions failed */}
            {directionsError && captainLocation?.ltd && selectedPath.length > 0 && (
              <Polyline
                path={[
                  { lat: captainLocation.ltd, lng: captainLocation.lng },
                  selectedPath[0],
                ]}
                options={{ strokeColor: '#3b82f6', strokeWeight: 5, strokeOpacity: 0.7, strokeDasharray: '8 4' }}
              />
            )}
            {/* Pickup destination marker */}
            {selectedPath.length > 0 && window.google && (
              <Marker
                position={selectedPath[0]}
                icon={{
                  path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
                  fillColor: '#22c55e',
                  fillOpacity: 1,
                  strokeWeight: 1,
                  strokeColor: '#fff',
                  scale: 2.2,
                  anchor: new window.google.maps.Point(12, 22),
                  labelOrigin: new window.google.maps.Point(12, -12),
                }}
                label={{ text: 'PICKUP', color: '#15803d', fontWeight: 'bold', fontSize: '11px' }}
                zIndex={200}
              />
            )}
          </>
        )}

        {/* ── PHASE 2 & 3: At pickup or on ride — show user-selected route ── */}
        {(captainStatus === 'at_pickup' || captainStatus === 'on_ride') && (
          <>
            {/* Safety-colored segments */}
            {coloredSegments.length > 0
              ? coloredSegments.map((seg, idx) => (
                  <Polyline
                    key={`seg-${idx}`}
                    path={seg.path}
                    options={{
                      strokeColor: seg.color,
                      strokeWeight: seg.isUnsafe ? 12 : 9,
                      strokeOpacity: 1.0,
                      zIndex: 15,
                    }}
                  />
                ))
              : selectedPath.length > 0 && (
                  <Polyline
                    path={selectedPath}
                    options={{
                      strokeColor: isSafest ? '#22c55e' : '#3b82f6',
                      strokeWeight: 9,
                      strokeOpacity: 1.0,
                      zIndex: 10,
                    }}
                  />
                )}
            {/* Pickup marker */}
            {selectedPath.length > 0 && window.google && (
              <Marker
                position={selectedPath[0]}
                icon={{
                  path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
                  fillColor: '#22c55e', fillOpacity: 1, strokeWeight: 1, strokeColor: '#fff',
                  scale: 2, anchor: new window.google.maps.Point(12, 22),
                  labelOrigin: new window.google.maps.Point(12, -10),
                }}
                label={{ text: 'PICKUP', color: '#22c55e', fontWeight: 'bold', fontSize: '10px' }}
                zIndex={200}
              />
            )}
            {/* Drop marker */}
            {selectedPath.length > 0 && window.google && (
              <Marker
                position={selectedPath[selectedPath.length - 1]}
                icon={{
                  path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
                  fillColor: '#ef4444', fillOpacity: 1, strokeWeight: 1, strokeColor: '#fff',
                  scale: 2, anchor: new window.google.maps.Point(12, 22),
                  labelOrigin: new window.google.maps.Point(12, -10),
                }}
                label={{ text: 'DROP', color: '#ef4444', fontWeight: 'bold', fontSize: '10px' }}
                zIndex={200}
              />
            )}
          </>
        )}

        {/* Captain marker (always visible) */}
        {captainLocation?.ltd && captainLocation?.lng && window.google && (
          <Marker
            position={{ lat: captainLocation.ltd, lng: captainLocation.lng }}
            icon={{
              url: 'https://cdn-icons-png.flaticon.com/512/75/75780.png',
              scaledSize: new window.google.maps.Size(44, 44),
              anchor: new window.google.maps.Point(22, 22),
            }}
            zIndex={300}
          />
        )}
      </GoogleMap>

      {/* Recenter button */}
      {userInteracted && (
        <button
          onClick={() => { setUserInteracted(false); fitBounds(); }}
          className="absolute right-4 bottom-6 bg-white p-3 rounded-full shadow-xl border border-zinc-200 z-[999]"
          title="Recenter"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="2" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      )}
    </div>
  );
};

const MapStyles = [
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

export default CaptainMapComponent;
