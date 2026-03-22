import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { MapPinMinus, MapPinPlus, Loader2, Navigation } from 'lucide-react';

const TrackRideScreen = () => {
    const { id } = useParams();
    const [trackingData, setTrackingData] = useState(null);
    const [error, setError] = useState('');
    const [mapLocation, setMapLocation] = useState('');

    useEffect(() => {
        let socket;
        
        const fetchTrackingData = async () => {
            try {
                const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/ride/track/${id}`);
                setTrackingData(response.data);
                
                if (response.data.captain && response.data.captain.location && response.data.captain.location.coordinates) {
                    const { coordinates } = response.data.captain.location;
                    setMapLocation(`https://www.google.com/maps?q=${coordinates[1]},${coordinates[0]}&output=embed`);
                } else if (response.data.pickup) {
                    setMapLocation(`https://www.google.com/maps?q=${response.data.pickup}&output=embed`);
                }

                // Connect to socket and join room for live tracking without auth token
                socket = io(import.meta.env.VITE_SERVER_URL);
                socket.emit('join-room', id);

                socket.on("captain-location-updated", (data) => {
                    if (data.location && data.location.ltd && data.location.lng) {
                        setMapLocation(`https://www.google.com/maps?q=${data.location.ltd},${data.location.lng}&output=embed`);
                    }
                });
            } catch (err) {
                setError(err.response?.data?.message || 'Error fetching tracking details or link expired.');
            }
        };

        fetchTrackingData();

        return () => {
            if (socket) {
                socket.off("captain-location-updated");
                socket.disconnect();
            }
        };
    }, [id]);

    if (error) {
        return (
            <div className="flex w-full h-dvh items-center justify-center p-4 bg-zinc-50 text-center">
                <div className="bg-white p-8 rounded-3xl shadow-lg border border-red-100 max-w-sm">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Navigation className="text-red-500" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-zinc-800 mb-2">Tracking Unavailable</h2>
                    <p className="text-zinc-500 text-sm font-medium">{error}</p>
                </div>
            </div>
        );
    }

    if (!trackingData) {
        return (
            <div className="flex w-full h-dvh items-center justify-center bg-zinc-50 flex-col gap-4">
                <Loader2 className="animate-spin text-blue-600" size={40} />
                <p className="text-sm font-semibold text-zinc-500 animate-pulse">Connecting to Live Ride...</p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-dvh flex flex-col bg-zinc-50 overflow-hidden sm:min-w-96 sm:w-96 mx-auto shadow-2xl">
            {/* Header */}
            <div className="bg-white px-6 py-4 shadow-sm z-10 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-zinc-800 tracking-tight">Live Tracking</h1>
                    <div className="flex items-center gap-1.5 mt-1">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                        </span>
                        <p className="text-xs text-green-600 font-bold uppercase tracking-wider">{trackingData.status}</p>
                    </div>
                </div>
            </div>
            
            {/* Map */}
            <div className="flex-1 w-full bg-zinc-200 relative">
                {mapLocation ? (
                    <iframe
                        src={mapLocation}
                        className="w-full h-full border-none"
                        allowFullScreen={true}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        title="Live Location Map"
                    ></iframe>
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <p className="text-zinc-500 font-medium">Map Unavailable</p>
                    </div>
                )}
            </div>

            {/* Bottom Info Sheet */}
            <div className="bg-white pt-6 pb-8 px-6 shadow-[0_-12px_40px_rgba(0,0,0,0.1)] rounded-t-[32px] z-10">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-zinc-800 mb-0.5">Trip Details</h2>
                        <p className="text-xs font-medium text-zinc-400">SAARTHI Ride Share</p>
                    </div>
                    {trackingData.captain && (
                        <div className="text-right bg-zinc-50 px-4 py-2 rounded-2xl border border-zinc-100">
                            <h3 className="font-bold text-zinc-800">{trackingData.captain.firstname}</h3>
                            <p className="text-sm font-semibold text-zinc-600 tracking-wide mt-0.5">{trackingData.captain.vehicle?.number}</p>
                            <p className="text-[10px] text-zinc-400 capitalize font-bold tracking-wider mt-0.5">{trackingData.captain.vehicle?.color} {trackingData.captain.vehicle?.type}</p>
                        </div>
                    )}
                </div>

                <div className="space-y-4 relative bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                    <div className="flex items-start gap-4">
                        <MapPinMinus size={20} className="text-blue-500 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Pickup</p>
                            <p className="text-sm font-medium text-zinc-800 leading-snug">{trackingData.pickup}</p>
                        </div>
                    </div>

                    <div className="border-t border-zinc-200 ml-9 my-3"></div>

                    <div className="flex items-start gap-4">
                        <MapPinPlus size={20} className="text-green-500 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Drop-off</p>
                            <p className="text-sm font-medium text-zinc-800 leading-snug">{trackingData.destination}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrackRideScreen;
