import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useUser } from "../contexts/UserContext";
import map from "/map.png";
import logo from "/saarthi.png";
import {
  Button,
  LocationSuggestions,
  SelectVehicle,
  RideDetails,
  Sidebar,
  RouteSelector,
  MapComponent,
} from "../components";
import axios from "axios";
import debounce from "lodash.debounce";
import { SocketDataContext } from "../contexts/SocketContext";
import Console from "../utils/console";

function UserHomeScreen() {
  const token = localStorage.getItem("token");
  const { socket } = useContext(SocketDataContext);
  const { user } = useUser();
  const [messages, setMessages] = useState(
    JSON.parse(localStorage.getItem("messages")) || []
  );
  const [loading, setLoading] = useState(false);
  const [selectedInput, setSelectedInput] = useState("pickup");
  const [locationSuggestion, setLocationSuggestion] = useState([]);
  const [mapLocation, setMapLocation] = useState("");
  const [rideCreated, setRideCreated] = useState(false);
  const [rideId, setRideId] = useState("");

  // Route & Fare details
  const [pickupLocation, setPickupLocation] = useState("");
  const [destinationLocation, setDestinationLocation] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("car");
  const [fare, setFare] = useState({
    auto: 0,
    car: 0,
    bike: 0,
  });
  const [confirmedRideData, setConfirmedRideData] = useState(null);
  const [rideStatus, setRideStatus] = useState("pending");
  const rideTimeout = useRef(null);

  // Fastest/Safest selections
  const [selectedRouteMode, setSelectedRouteMode] = useState("fastest");
  const [routesData, setRoutesData] = useState(null);

  // Panels
  const [showFindTripPanel, setShowFindTripPanel] = useState(true);
  const [showSelectVehiclePanel, setShowSelectVehiclePanel] = useState(false);
  const [showRideDetailsPanel, setShowRideDetailsPanel] = useState(false);

  const handleLocationChange = useCallback(
    debounce(async (inputValue, token) => {
      if (inputValue.length >= 3) {
        try {
          const response = await axios.get(
            `${import.meta.env.VITE_SERVER_URL}/map/get-suggestions?input=${inputValue}`,
            { headers: { token: token } }
          );
          Console.log(response.data);
          setLocationSuggestion(response.data);
        } catch (error) {
          Console.error(error);
        }
      }
    }, 300),
    []
  );

  const onChangeHandler = (e) => {
    setSelectedInput(e.target.id);
    const value = e.target.value;
    if (e.target.id == "pickup") {
      setPickupLocation(value);
    } else if (e.target.id == "destination") {
      setDestinationLocation(value);
    }
    handleLocationChange(value, token);
    if (e.target.value.length < 3) {
      setLocationSuggestion([]);
    }
  };

  const getDistanceAndFare = async (pickupLocation, destinationLocation) => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_SERVER_URL}/ride/get-fare?pickup=${pickupLocation}&destination=${destinationLocation}`,
        { headers: { token: token } }
      );
      
      setRoutesData(response.data);
      setFare(response.data.fastest.fare);
      setSelectedRouteMode('fastest');

      setShowFindTripPanel(false);
      setShowSelectVehiclePanel(true);
      setLocationSuggestion([]);
      setLoading(false);
    } catch (error) {
      Console.log(error);
      setLoading(false);
    }
  };

  const handleRouteModeChange = (mode) => {
    setSelectedRouteMode(mode);
    setFare(routesData[mode].fare);
  };

  const createRide = async () => {
    try {
      setLoading(true);
      const response = await axios.post(
        `${import.meta.env.VITE_SERVER_URL}/ride/create`,
        {
          pickup: pickupLocation,
          destination: destinationLocation,
          vehicleType: selectedVehicle,
          selectedRouteMode: selectedRouteMode,
        },
        { headers: { token: token } }
      );
      
      const rideData = {
        pickup: pickupLocation,
        destination: destinationLocation,
        vehicleType: selectedVehicle,
        fare: fare,
        confirmedRideData: confirmedRideData,
        _id: response.data._id,
      };
      localStorage.setItem("rideDetails", JSON.stringify(rideData));
      setLoading(false);
      setRideCreated(true);
      setRideId(response.data._id);

      rideTimeout.current = setTimeout(() => {
        cancelRide();
      }, import.meta.env.VITE_RIDE_TIMEOUT);
      
    } catch (error) {
      Console.log(error);
      setLoading(false);
    }
  };

  const cancelRide = async () => {
    const rideDetails = JSON.parse(localStorage.getItem("rideDetails"));
    if (!rideDetails || (!rideDetails._id && !rideDetails.confirmedRideData?._id)) {
      return;
    }
    try {
      setLoading(true);
      await axios.get(
        `${import.meta.env.VITE_SERVER_URL}/ride/cancel?rideId=${rideDetails._id || rideDetails.confirmedRideData._id}`,
        { headers: { token: token } }
      );
      setLoading(false);
      updateLocation();
      setShowRideDetailsPanel(false);
      setShowSelectVehiclePanel(false);
      setShowFindTripPanel(true);
      setDefaults();
      localStorage.removeItem("rideDetails");
      localStorage.removeItem("panelDetails");
      localStorage.removeItem("messages");
    } catch (error) {
      Console.log(error);
      setLoading(false);
    }
  };

  const setDefaults = () => {
    setPickupLocation("");
    setDestinationLocation("");
    setSelectedVehicle("car");
    setFare({ auto: 0, car: 0, bike: 0 });
    setConfirmedRideData(null);
    setRideCreated(false);
    setRoutesData(null);
  };

  const updateLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapLocation(`https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}&output=embed`);
        },
        (error) => console.error("Error fetching position:", error)
      );
    }
  };

  useEffect(() => {
    updateLocation();
  }, []);

  useEffect(() => {
    if (user._id) {
      socket.emit("join", { userId: user._id, userType: "user" });
    }

    socket.on("ride-confirmed", (data) => {
      clearTimeout(rideTimeout.current);
      setMapLocation(`https://www.google.com/maps?q=${data.captain.location.coordinates[1]},${data.captain.location.coordinates[0]} to ${pickupLocation}&output=embed`);
      setConfirmedRideData(data);
      setRideStatus("accepted");
    });

    socket.on("ride-arrived", (data) => {
        setRideStatus("arrived");
        setMapLocation(`https://www.google.com/maps?q=${data.pickup}&output=embed`);
    });

    socket.on("ride-started", (data) => {
      setRideStatus("ongoing");
      setMapLocation(`https://www.google.com/maps?q=${data.pickup} to ${data.destination}&output=embed`);
    });

    socket.on("captain-location-updated", (data) => {
      if (confirmedRideData) {
        setMapLocation(`https://www.google.com/maps?q=${data.location.ltd},${data.location.lng} to ${pickupLocation}&output=embed`);
      }
    });

    socket.on("ride-ended", (data) => {
      setShowRideDetailsPanel(false);
      setShowSelectVehiclePanel(false);
      setShowFindTripPanel(true);
      setDefaults();
      localStorage.removeItem("rideDetails");
      localStorage.removeItem("panelDetails");
      socket.off("captain-location-updated");
      updateLocation();
    });

    return () => {
      socket.off("ride-confirmed");
      socket.off("ride-arrived");
      socket.off("ride-started");
      socket.off("ride-ended");
      socket.off("captain-location-updated");
    };
  }, [user]);

  useEffect(() => {
    const storedRideDetails = localStorage.getItem("rideDetails");
    const storedPanelDetails = localStorage.getItem("panelDetails");

    if (storedRideDetails) {
      const ride = JSON.parse(storedRideDetails);
      setPickupLocation(ride.pickup);
      setDestinationLocation(ride.destination);
      setSelectedVehicle(ride.vehicleType);
      setFare(ride.fare);
      setConfirmedRideData(ride.confirmedRideData);
      setRideId(ride._id || "");
    }

    if (storedPanelDetails) {
      const panels = JSON.parse(storedPanelDetails);
      setShowFindTripPanel(panels.showFindTripPanel);
      setShowSelectVehiclePanel(panels.showSelectVehiclePanel);
      setShowRideDetailsPanel(panels.showRideDetailsPanel);
    }
  }, []);

  useEffect(() => {
    const rideData = {
      pickup: pickupLocation,
      destination: destinationLocation,
      vehicleType: selectedVehicle,
      fare: fare,
      confirmedRideData: confirmedRideData,
      _id: rideId,
    };
    localStorage.setItem("rideDetails", JSON.stringify(rideData));
  }, [pickupLocation, destinationLocation, selectedVehicle, fare, confirmedRideData, rideId]);

  useEffect(() => {
    const panelDetails = { showFindTripPanel, showSelectVehiclePanel, showRideDetailsPanel };
    localStorage.setItem("panelDetails", JSON.stringify(panelDetails));
  }, [showFindTripPanel, showSelectVehiclePanel, showRideDetailsPanel]);

  useEffect(() => {
    localStorage.setItem("messages", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    socket.emit("join-room", confirmedRideData?._id);
    socket.on("receiveMessage", (msg) => {
      setMessages((prev) => [...prev, { msg, by: "other" }]);
    });
    return () => {
      socket.off("receiveMessage");
    };
  }, [confirmedRideData]);

  return (
    <div className="relative w-full h-dvh bg-zinc-50 overflow-hidden">
      <Sidebar />
      <img
        className="h-12 object-contain absolute left-5 top-5 z-10"
        src={logo}
        alt="Logo"
      />
      
      {/* Map Section */}
      <div className="absolute top-0 left-0 w-full h-[70vh] z-0">
        {routesData ? (
          <MapComponent 
            routesData={routesData} 
            selectedMode={selectedRouteMode} 
            onRouteClick={handleRouteModeChange} 
          />
        ) : (
          <iframe
            src={mapLocation}
            className="w-full h-full border-none"
            allowFullScreen={true}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          ></iframe>
        )}
      </div>

      {/* Main Panel */}
      <div className={`absolute bottom-0 w-full bg-white rounded-t-[32px] shadow-[0_-12px_40px_rgba(0,0,0,0.1)] z-10 transition-all duration-500 max-h-[90vh] flex flex-col overflow-hidden`}>
        
        {/* Step 1: Find a trip */}
        {showFindTripPanel && (
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Find a trip</h1>
            <div className="flex flex-col gap-3 relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-0.5 h-1/2 bg-black/10 z-0"></div>
                <div className="relative">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 border-black bg-white z-10 mx-3"></div>
                    <input
                        id="pickup"
                        placeholder="Add a pick-up location"
                        className="w-full bg-zinc-100 pl-10 pr-4 py-3 rounded-xl outline-none focus:ring-2 ring-black/5 text-sm"
                        value={pickupLocation}
                        onChange={onChangeHandler}
                        autoComplete="off"
                    />
                </div>
                <div className="relative">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 border-2 border-black bg-white z-10 mx-3"></div>
                    <input
                        id="destination"
                        placeholder="Add a drop-off location"
                        className="w-full bg-zinc-100 pl-10 pr-4 py-3 rounded-xl outline-none focus:ring-2 ring-black/5 text-sm"
                        value={destinationLocation}
                        onChange={onChangeHandler}
                        autoComplete="off"
                    />
                </div>
            </div>

            {pickupLocation.length > 2 && destinationLocation.length > 2 && (
              <div className="mt-4">
                <Button
                    title={"Search"}
                    loading={loading}
                    fun={() => getDistanceAndFare(pickupLocation, destinationLocation)}
                />
              </div>
            )}

            <div className="mt-4 max-h-[25vh] overflow-y-auto">
              {locationSuggestion.length > 0 && (
                <LocationSuggestions
                  suggestions={locationSuggestion}
                  setSuggestions={setLocationSuggestion}
                  setPickupLocation={setPickupLocation}
                  setDestinationLocation={setDestinationLocation}
                  input={selectedInput}
                />
              )}
            </div>
          </div>
        )}

        {/* Step 2: Select Vehicle & Route */}
        {showSelectVehiclePanel && routesData && (
          <>
            <RouteSelector 
              selectedMode={selectedRouteMode} 
              onSelect={handleRouteModeChange} 
              fastest={routesData.fastest}
              safest={routesData.safest}
              onBack={() => {
                  setShowSelectVehiclePanel(false);
                  setShowFindTripPanel(true);
              }}
            />
            <div className="px-4 pb-4 overflow-y-auto">
                <SelectVehicle
                    selectedVehicle={setSelectedVehicle}
                    setShowPanel={setShowSelectVehiclePanel}
                    showNextPanel={setShowRideDetailsPanel}
                    fare={fare}
                />
            </div>
          </>
        )}

        {/* Step 3: Ride Details & Confirmation */}
        {showRideDetailsPanel && (
            <div className="overflow-y-auto">
                <RideDetails
                  pickupLocation={pickupLocation}
                  destinationLocation={destinationLocation}
                  selectedVehicle={selectedVehicle}
                  fare={fare}
                  showPanel={showRideDetailsPanel}
                  setShowPanel={setShowRideDetailsPanel}
                  showPreviousPanel={setShowSelectVehiclePanel}
                  createRide={createRide}
                  cancelRide={cancelRide}
                  loading={loading}
                  rideCreated={rideCreated}
                  confirmedRideData={confirmedRideData}
                  rideStatus={rideStatus}
                />
            </div>
        )}
      </div>
    </div>
  );
}

export default UserHomeScreen;
