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
  MapComponent,
  RouteSelector,
  FeedbackModal,
  AISuggestions,
  SaarthiAIModal,
} from "../components";
import { getSafetySuggestion, getSafePlaces, calculateBookingTime } from "../utils/aiAssistant";
import { Sparkles } from "lucide-react";
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
  const [rideMode, setRideMode] = useState("normal");
  const [timeoutMessage, setTimeoutMessage] = useState("");

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
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [lastRideData, setLastRideData] = useState(null);
  
  // Saarthi AI State
  const [showSaarthiModal, setShowSaarthiModal] = useState(false);
  const [autoBookingTask, setAutoBookingTask] = useState(
    JSON.parse(localStorage.getItem("autoBookingTask")) || null
  );
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [safePlacesData, setSafePlacesData] = useState(null);
  const [autoBookingMessage, setAutoBookingMessage] = useState("");
  const [showAISuggestions, setShowAISuggestions] = useState(false);

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
      setTimeoutMessage("");
      const response = await axios.get(
        `${import.meta.env.VITE_SERVER_URL}/ride/get-fare?pickup=${pickupLocation}&destination=${destinationLocation}`,
        { headers: { token: token } }
      );
      
      if (response.data && response.data.fastest) {
        setRoutesData(response.data);
        setFare(response.data.fastest.fare);
        setSelectedRouteMode('fastest');

        // AI Suggestions
        const crimeIndex = 100 - (response.data.fastest.safetyScore || 65);
        const hour = new Date().getHours();
        setAiSuggestions(getSafetySuggestion({ time: hour, crimeIndex }));
        setSafePlacesData(getSafePlaces({ time: hour }));
        setShowAISuggestions(true); // Trigger floating UI

        setShowFindTripPanel(false);
        setShowSelectVehiclePanel(true);
      } else {
        alert("Unable to fetch routes. Please check your locations.");
      }
      setLocationSuggestion([]);
      setLoading(false);
    } catch (error) {
      Console.error(error);
      setLoading(false);
      alert("Failed to find routes. Please try again.");
    }
  };

  const handleRouteModeChange = (mode) => {
    if (routesData && routesData[mode]) {
      setSelectedRouteMode(mode);
      setFare(routesData[mode].fare);
      
      const crimeIndex = 100 - (routesData[mode].safetyScore || 65);
      const hour = new Date().getHours();
      setAiSuggestions(getSafetySuggestion({ time: hour, crimeIndex }));
      setSafePlacesData(getSafePlaces({ time: hour }));
      setShowAISuggestions(true); // Re-trigger on route change
    }
  };

  // Auto-fade AI Suggestions after 6 seconds
  useEffect(() => {
    let timer;
    if (showAISuggestions) {
      timer = setTimeout(() => {
        setShowAISuggestions(false);
      }, 6000);
    }
    return () => clearTimeout(timer);
  }, [showAISuggestions]);

  const createRide = async () => {
    try {
      setLoading(true);
      setTimeoutMessage(""); // Clear previous timeout message
      if (rideTimeout.current) clearTimeout(rideTimeout.current);

      const response = await axios.post(
        `${import.meta.env.VITE_SERVER_URL}/ride/create`,
        {
          pickup: pickupLocation,
          destination: destinationLocation,
          vehicleType: selectedVehicle,
          selectedRouteMode: selectedRouteMode,
          genderPreference: rideMode === "female-only" ? "female" : null,
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
        setTimeoutMessage("No riders are currently available in your area. Please try after some time or change location.");
      }, 20000); // 20 seconds
      
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
      if (rideTimeout.current) clearTimeout(rideTimeout.current);
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
      const origin = `${data.captain.location.coordinates[1]},${data.captain.location.coordinates[0]}`;
      const destination = encodeURIComponent(pickupLocation);
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API;
      setMapLocation(`https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${origin}&destination=${destination}&mode=driving`);
      setRoutesData(null); // Switch from trip overview to live tracking (iframe)
      setConfirmedRideData(data);
      setRideStatus("accepted");
    });

    socket.on("ride-arrived", (data) => {
        setRideStatus("arrived");
        setMapLocation(`https://www.google.com/maps?q=${encodeURIComponent(data.pickup)}&output=embed`);
    });

    socket.on("ride-started", (data) => {
      setRideStatus("ongoing");
      const origin = encodeURIComponent(data.pickup);
      const destination = encodeURIComponent(data.destination);
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API;
      setMapLocation(`https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${origin}&destination=${destination}&mode=driving`);
    });

    socket.on("captain-location-updated", (data) => {
      if (confirmedRideData) {
        const origin = `${data.location.ltd},${data.location.lng}`;
        const destination = encodeURIComponent(pickupLocation);
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API;
        setMapLocation(`https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${origin}&destination=${destination}&mode=driving`);
      }
    });

    socket.on("ride-ended", (data) => {
      setLastRideData(data);
      setShowFeedbackModal(true);
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
  }, [user, socket]);

  // Saarthi AI: Auto Booking Check
  useEffect(() => {
    let interval = null;
    
    if (autoBookingTask) {
      Console.log(`Saarthi AI active. Target booking time: ${autoBookingTask.bookingTime}`);
      interval = setInterval(() => {
        const now = new Date();
        const bookingTime = new Date(autoBookingTask.bookingTime);
        
        if (now >= bookingTime) {
          Console.log("Saarthi AI: Booking condition met!");
          setAutoBookingMessage("Saarthi AI is booking your ride now to ensure timely arrival.");
          handleAutoBookingTrigger(autoBookingTask);
          setAutoBookingTask(null);
          localStorage.removeItem("autoBookingTask");
          if (interval) clearInterval(interval);
        }
      }, 5000); // Check more frequently (every 5 seconds)
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoBookingTask]);

  const handleAutoBookingTrigger = async (task) => {
    try {
      setLoading(true);
      setAutoBookingMessage("Saarthi AI is fetching current route details...");
      
      const response = await axios.get(
        `${import.meta.env.VITE_SERVER_URL}/ride/get-fare?pickup=${task.pickup}&destination=${task.destination}`,
        { headers: { token: token } }
      );
      
      if (!response.data || !response.data.fastest) {
        throw new Error("Unable to fetch routes for auto-booking");
      }

      setRoutesData(response.data);
      setFare(response.data.fastest.fare);
      setPickupLocation(task.pickup);
      setDestinationLocation(task.destination);
      
      setAutoBookingMessage("Saarthi AI is contacting captains...");
      
      const createResponse = await axios.post(
        `${import.meta.env.VITE_SERVER_URL}/ride/create`,
        {
          pickup: task.pickup,
          destination: task.destination,
          vehicleType: "car", // Default car for SaaS auto-book
          selectedRouteMode: "fastest",
        },
        { headers: { token: token } }
      );
      
      const rideData = {
        pickup: task.pickup,
        destination: task.destination,
        vehicleType: "car",
        fare: response.data.fastest.fare,
        confirmedRideData: null,
        _id: createResponse.data._id,
      };
      
      localStorage.setItem("rideDetails", JSON.stringify(rideData));
      setRideId(createResponse.data._id);
      
      setShowFindTripPanel(false);
      setShowRideDetailsPanel(true);
      setRideCreated(true);
      setLoading(false);
      
      // Clear message after success
      setTimeout(() => setAutoBookingMessage(""), 5000);

      // Start timeout for no captains
      rideTimeout.current = setTimeout(() => {
        cancelRide();
        setTimeoutMessage("No riders are currently available for your scheduled ride. Please try manually.");
      }, 30000);

    } catch (error) {
      Console.error("Auto-booking failed:", error);
      setLoading(false);
      setAutoBookingMessage("");
      alert("Saarthi AI was unable to book your scheduled ride. Please check your connection or locations.");
    }
  };

  const startAutoBooking = async (data) => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_SERVER_URL}/ride/get-fare?pickup=${data.pickup}&destination=${data.destination}`,
        { headers: { token: token } }
      );
      
      const travelTimeMinutes = Math.ceil(response.data.fastest.duration.value / 60);
      const bookingTime = calculateBookingTime(data.arrivalTime, travelTimeMinutes, 5);
      
      const task = {
        ...data,
        bookingTime: bookingTime.toISOString(),
      };
      
      setAutoBookingTask(task);
      localStorage.setItem("autoBookingTask", JSON.stringify(task));
      setLoading(false);
      setShowSaarthiModal(false);
      
      alert(`Saarthi AI scheduled your ride booking for ${bookingTime.toLocaleTimeString()}`);
    } catch (error) {
      Console.error(error);
      setLoading(false);
      alert("Failed to schedule auto-booking. Please check locations.");
    }
  };

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
    if (confirmedRideData?._id) {
      socket.emit("join-room", confirmedRideData?._id);
    }
    socket.on("receiveMessage", (msg) => {
      setMessages((prev) => [...prev, { msg, by: "other" }]);
    });
    return () => {
      socket.off("receiveMessage");
    };
  }, [confirmedRideData]);

  return (
    <div className={`relative w-full h-dvh overflow-hidden transition-colors duration-500 ${
      rideMode === "female-only" ? "bg-gradient-to-br from-pink-50 to-purple-100" : "bg-zinc-50"
    }`}>
      <Sidebar />
      <img
        className="h-12 object-contain absolute left-5 top-5 z-10"
        src={logo}
        alt="Logo"
      />

      {/* Floating Saarthi AI Button */}
      <button 
        onClick={() => setShowSaarthiModal(true)}
        className="absolute right-4 top-16 z-[60] p-3 bg-white border border-zinc-100 shadow-xl rounded-full hover:scale-110 active:scale-95 transition-all duration-300 group"
        title="Use Saarthi AI"
      >
        <Sparkles size={24} className="text-blue-600 transition-colors group-hover:text-blue-500" />
      </button>

      {/* Floating AI Suggestions Popup */}
      {showAISuggestions && aiSuggestions && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm animate-in fade-in slide-in-from-top-4 duration-500">
          <AISuggestions 
            suggestion={aiSuggestions} 
            safePlacesData={safePlacesData} 
          />
          <div className="absolute top-1 right-1 p-1">
            <button onClick={() => setShowAISuggestions(false)} className="text-zinc-400 hover:text-zinc-600">
              <Sparkles size={12} className="opacity-50" />
            </button>
          </div>
        </div>
      )}
      
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
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold">Find a trip</h1>
              {user.gender === "female" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-500">Female Only</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={rideMode === "female-only"}
                      onChange={() => setRideMode(prev => prev === "normal" ? "female-only" : "normal")}
                    />
                    <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
                  </label>
                </div>
              )}
            </div>
            {timeoutMessage && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4 border border-red-100">
                {timeoutMessage}
              </div>
            )}
            
            {autoBookingMessage && (
              <div className="bg-blue-50 text-blue-600 p-3 rounded-xl text-sm mb-4 border border-blue-100 flex items-center gap-2">
                <Sparkles size={16} className="animate-pulse" />
                {autoBookingMessage}
              </div>
            )}

            {autoBookingTask && (
              <div className="bg-zinc-50 border border-zinc-100 p-3 rounded-xl mb-4 flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold text-zinc-900">Auto-booking active</p>
                  <p className="text-zinc-500">Pick: {autoBookingTask.pickup} • Arr: {autoBookingTask.arrivalTime}</p>
                </div>
                <button 
                  onClick={() => {
                    setAutoBookingTask(null);
                    localStorage.removeItem("autoBookingTask");
                  }}
                  className="text-red-600 font-bold"
                >
                  Cancel
                </button>
              </div>
            )}
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
                {/* Old AI Suggestions placement removed to use floating version */}
            </div>
        )}
      </div>

      <SaarthiAIModal 
        isOpen={showSaarthiModal} 
        onClose={() => {
          setShowSaarthiModal(false);
          setLocationSuggestion([]);
        }}
        onStartAutoBooking={startAutoBooking}
        loading={loading}
        suggestions={locationSuggestion}
        onLocationChange={(value) => handleLocationChange(value, token)}
        setSuggestions={setLocationSuggestion}
      />

      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        rideId={lastRideData?._id}
        driverName={`${lastRideData?.captain?.fullname?.firstname} ${lastRideData?.captain?.fullname?.lastname}`}
      />
    </div>
  );
}

export default UserHomeScreen;
