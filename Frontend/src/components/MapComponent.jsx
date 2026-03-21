import React, { useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Polyline, Marker } from '@react-google-maps/api';
import { decodePolyline } from '../utils/polyline';

const containerStyle = {
  width: '100%',
  height: '100%'
};

const MapComponent = ({ routesData, selectedMode, onRouteClick }) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API
  });

  const fastestPath = useMemo(() => decodePolyline(routesData?.fastest?.polyline), [routesData]);
  const safestPath = useMemo(() => decodePolyline(routesData?.safest?.polyline), [routesData]);

  const center = useMemo(() => {
    if (fastestPath.length > 0) return fastestPath[0];
    return { lat: 21.1458, lng: 79.0882 }; // Nagpur center
  }, [fastestPath]);

  if (!isLoaded) return <div className="w-full h-full bg-zinc-200 animate-pulse" />;

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={13}
      options={{
        disableDefaultUI: true,
        styles: [
            {
              "featureType": "administrative",
              "elementType": "geometry",
              "stylers": [{ "visibility": "off" }]
            },
            {
              "featureType": "poi",
              "stylers": [{ "visibility": "off" }]
            },
            {
              "featureType": "road",
              "elementType": "labels.icon",
              "stylers": [{ "visibility": "off" }]
            },
            {
              "featureType": "transit",
              "stylers": [{ "visibility": "off" }]
            }
          ]
      }}
    >
      {/* Fastest Route - Blue */}
      <Polyline
        path={fastestPath}
        onClick={() => onRouteClick && onRouteClick('fastest')}
        options={{
          strokeColor: selectedMode === 'fastest' ? '#2563eb' : '#94a3b8',
          strokeWeight: selectedMode === 'fastest' ? 6 : 4,
          strokeOpacity: selectedMode === 'fastest' ? 1.0 : 0.6,
          zIndex: selectedMode === 'fastest' ? 10 : 5
        }}
      />

      {/* Safest Route - Green */}
      <Polyline
        path={safestPath}
        onClick={() => onRouteClick && onRouteClick('safest')}
        options={{
          strokeColor: selectedMode === 'safest' ? '#16a34a' : '#94a3b8',
          strokeWeight: selectedMode === 'safest' ? 6 : 4,
          strokeOpacity: selectedMode === 'safest' ? 1.0 : 0.6,
          zIndex: selectedMode === 'safest' ? 10 : 5
        }}
      />

      {fastestPath.length > 0 && (
        <>
            <Marker position={fastestPath[0]} label="A" />
            <Marker position={fastestPath[fastestPath.length - 1]} label="B" />
        </>
      )}
    </GoogleMap>
  );
};

export default MapComponent;
