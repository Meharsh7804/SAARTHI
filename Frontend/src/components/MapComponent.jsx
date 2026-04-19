import React, { useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Polyline, Marker, InfoWindow } from '@react-google-maps/api';
import { decodePolyline } from '../utils/polyline';

const containerStyle = {
  width: '100%',
  height: '100%'
};

const getSafetyColor = (score) => {
  if (score >= 7) return '#22c55e'; // Green
  if (score >= 4) return '#eab308'; // Yellow
  return '#ef4444'; // Red
};

const MapComponent = ({ routesData, selectedMode, onRouteClick, rideStatus, confirmedRideData, userLocation }) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API
  });

  const mapRef = React.useRef(null);
  const [userInteracted, setUserInteracted] = React.useState(false);
  const [activeSegment, setActiveSegment] = React.useState(null);

  const selectedRoute = useMemo(() => routesData?.[selectedMode], [routesData, selectedMode]);

  const coloredSegments = useMemo(() => {
    if (!selectedRoute?.segments) return [];
    return selectedRoute.segments.map(seg => ({
      path: decodePolyline(seg.polyline),
      color: getSafetyColor(seg.safety_score),
      isUnsafe: seg.safety_score < 4,
      safety_score: seg.safety_score
    }));
  }, [selectedRoute]);

  const fastestPath = useMemo(() => {
    try {
      return routesData?.fastest?.polyline ? decodePolyline(routesData.fastest.polyline) : [];
    } catch (e) { return []; }
  }, [routesData]);

  const safestPath = useMemo(() => {
    try {
      return routesData?.safest?.polyline ? decodePolyline(routesData.safest.polyline) : [];
    } catch (e) { return []; }
  }, [routesData]);

  const handleRecenter = React.useCallback(() => {
    if (!mapRef.current || !window.google) return;
    const bounds = new window.google.maps.LatLngBounds();

    if (rideStatus === 'ongoing') {
        mapRef.current.panTo(userLocation);
        mapRef.current.setZoom(16);
    } else if (['accepted', 'arrived'].includes(rideStatus) && confirmedRideData?.captain?.location) {
        bounds.extend(userLocation);
        if (fastestPath.length > 0) bounds.extend(fastestPath[0]);
        bounds.extend({
            lat: confirmedRideData.captain.location.coordinates[1],
            lng: confirmedRideData.captain.location.coordinates[0]
        });
        mapRef.current.fitBounds(bounds, { top: 120, bottom: 280, left: 80, right: 80 });
        setTimeout(() => {
          if (mapRef.current.getZoom() > 16) mapRef.current.setZoom(16);
        }, 100);
    } else if (fastestPath.length > 0) {
        bounds.extend(userLocation);
        fastestPath.forEach(point => bounds.extend(point));
        mapRef.current.fitBounds(bounds, { top: 120, bottom: 300, left: 80, right: 80 });
    } else if (userLocation) {
        mapRef.current.panTo(userLocation);
        if (mapRef.current.getZoom() < 15) mapRef.current.setZoom(15);
    }
    setUserInteracted(false);
  }, [rideStatus, userLocation, fastestPath, confirmedRideData, isLoaded]);

  // Dynamic Views based on Ride State (Only if user hasn't moved the map)
  React.useEffect(() => {
    if (!userInteracted) {
        handleRecenter();
    }
  }, [rideStatus, userLocation, fastestPath, confirmedRideData, userInteracted, handleRecenter]);

  const routesAreIdentical = useMemo(() => {
    return routesData?.fastest?.polyline === routesData?.safest?.polyline && fastestPath.length > 0;
  }, [routesData, fastestPath]);

  // Center calculation for initial map mount
  const center = useMemo(() => {
    if (fastestPath && fastestPath.length > 0) return fastestPath[0];
    if (userLocation) return userLocation;
    return { lat: 21.1458, lng: 79.0882 }; // Nagpur center
  }, [fastestPath, userLocation]);

  if (!isLoaded) return <div className="w-full h-full bg-zinc-200 animate-pulse" />;

  return (
    <div className="w-full h-full relative">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={15}
          onLoad={map => mapRef.current = map}
          onDragStart={() => setUserInteracted(true)}
          options={{
            disableDefaultUI: true,
            styles: MapStyles,
            gestureHandling: 'greedy'
          }}
        >
      {/* Current User Marker (Standard Blue Dot Style) */}
      {userLocation && window.google && (
        <Marker 
          position={userLocation} 
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#3b82f6",
            fillOpacity: 1,
            strokeWeight: 3,
            strokeColor: "#ffffff",
          }}
          zIndex={100}
        />
      )}

      {/* Fastest Route (Always Blue) */}
      {fastestPath.length > 0 && (
        <Polyline
            path={fastestPath}
            onClick={() => onRouteClick && onRouteClick('fastest')}
            options={{
                strokeColor: '#3b82f6', 
                strokeWeight: selectedMode === 'fastest' ? 10 : 7,
                strokeOpacity: selectedMode === 'fastest' ? 1.0 : 0.6,
                zIndex: 10
            }}
        />
      )}

      {/* Safest Route (Always Green, thinner if overlapping) */}
      {safestPath.length > 0 && (
        <Polyline
            path={safestPath}
            onClick={() => onRouteClick && onRouteClick('safest')}
            options={{
                strokeColor: '#22c55e', 
                strokeWeight: selectedMode === 'safest' ? 10 : (routesAreIdentical ? 4 : 7),
                strokeOpacity: selectedMode === 'safest' ? 1.0 : 0.6,
                zIndex: selectedMode === 'safest' ? 11 : 5
            }}
        />
      )}

      {/* Primary Route Safety Segments Overlay (Only once ride starts) */}
      {['ongoing', 'accepted', 'arrived'].includes(rideStatus) && coloredSegments.map((segment, index) => (
        <Polyline
          key={`safety-seg-primary-${index}`}
          path={segment.path}
          onClick={() => segment.isUnsafe && setActiveSegment({
            pos: segment.path[Math.floor(segment.path.length / 2)],
            message: "High Incident Zone ⚠️"
          })}
          options={{
            strokeColor: segment.color,
            strokeWeight: segment.isUnsafe ? 12 : 9,
            strokeOpacity: 1.0,
            zIndex: 15
          }}
        />
      ))}

      {/* Dashed line to reaching pickup spot (Visible until trip starts) */}
      {userLocation && fastestPath.length > 0 && rideStatus !== 'ongoing' && (
        <Polyline
            path={[userLocation, fastestPath[0]]}
            options={{
                strokeColor: '#64748b',
                strokeOpacity: 0,
                strokeWeight: 2,
                icons: [{
                    icon: {
                        path: 'M 0,-1 0,1',
                        strokeOpacity: 1,
                        scale: 2
                    },
                    offset: '0',
                    repeat: '10px'
                }],
                zIndex: 2
            }}
        />
      )}

      {/* Route Markers (Professional Markers) */}
      {fastestPath.length > 0 && (
        <>
            <Marker 
                position={fastestPath[0]} 
                title="PICKUP" 
                icon={{
                    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
                    fillColor: '#10b981',
                    fillOpacity: 1,
                    strokeWeight: 2,
                    strokeColor: '#ffffff',
                    scale: 1.6,
                    anchor: new window.google.maps.Point(12, 22),
                }}
                zIndex={100}
            />

            <Marker 
                position={fastestPath[fastestPath.length - 1]} 
                title="DROP" 
                icon={{
                    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
                    fillColor: '#ef4444',
                    fillOpacity: 1,
                    strokeWeight: 2,
                    strokeColor: '#ffffff',
                    scale: 1.6,
                    anchor: new window.google.maps.Point(12, 22),
                }}
                zIndex={100}
            />
        </>
      )}

      {/* Captain Marker */}
      {(rideStatus === 'ongoing' || rideStatus === 'accepted' || rideStatus === 'arrived') && confirmedRideData?.captain?.location && (
        <Marker 
            position={{
                lat: confirmedRideData.captain.location.coordinates[1],
                lng: confirmedRideData.captain.location.coordinates[0]
            }}
            icon={{
                path: 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z',
                fillColor: '#000000',
                fillOpacity: 1,
                strokeWeight: 1,
                strokeColor: '#ffffff',
                scale: 1.5,
                anchor: new window.google.maps.Point(12, 12),
            }}
            zIndex={200}
        />

      )}

      {activeSegment && (
        <InfoWindow
          position={activeSegment.pos}
          onCloseClick={() => setActiveSegment(null)}
        >
          <div className="p-2">
             <p className="text-xs font-bold text-red-600 uppercase tracking-tighter">{activeSegment.message}</p>
             <p className="text-[10px] text-zinc-500">Caution advised while passing through here.</p>
          </div>
        </InfoWindow>
      )}
        </GoogleMap>

        {/* Floating Recenter Button */}
        {userInteracted && (
            <button 
                onClick={handleRecenter}
                className="absolute right-4 bottom-28 bg-white/95 backdrop-blur-sm p-3 rounded-full shadow-xl hover:bg-white transition-all active:scale-90 border border-zinc-200 group z-[999]"
                title="Recenter Map"
            >
                <div className="relative flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-90 transition-transform duration-300">
                        <circle cx="12" cy="12" r="2" />
                        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                    </svg>
                     <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                </div>
            </button>
        )}
    </div>
  );
};

const MapStyles = [
    {
        "featureType": "all",
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#444444" }]
    },
    {
        "featureType": "landscape",
        "elementType": "all",
        "stylers": [{ "color": "#f2f2f2" }]
    },
    {
        "featureType": "poi",
        "stylers": [{ "visibility": "off" }]
    },
    {
        "featureType": "road",
        "elementType": "all",
        "stylers": [{ "saturation": -100 }, { "lightness": 45 }]
    },
    {
        "featureType": "road.highway",
        "elementType": "all",
        "stylers": [{ "visibility": "simplified" }]
    },
    {
        "featureType": "road.arterial",
        "elementType": "labels.icon",
        "stylers": [{ "visibility": "off" }]
    },
    {
        "featureType": "transit",
        "stylers": [{ "visibility": "off" }]
    },
    {
        "featureType": "water",
        "elementType": "all",
        "stylers": [{ "color": "#cae3f1" }, { "visibility": "on" }]
    }
];

export default MapComponent;
