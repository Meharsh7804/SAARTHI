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
import { Sparkles, PhoneCall, ShieldAlert } from "lucide-react";
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
  const [currentUserLocation, setCurrentUserLocation] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
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
  const [usualRide, setUsualRide] = useState(null);

  // SOS Button State
  const [sosHolding, setSosHolding] = useState(false);
  const [sosProgress, setSosProgress] = useState(0);
  const sosTimerRef = useRef(null);
  const sosProgressRef = useRef(null);

  const handleSosStart = () => {
    setSosHolding(true);
    setSosProgress(0);
    const start = Date.now();
    const duration = 2000; // 2 seconds hold
    sosProgressRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setSosProgress(pct);
      if (pct >= 100) {
        clearInterval(sosProgressRef.current);
        clearTimeout(sosTimerRef.current);
        setSosHolding(false);
        setSosProgress(0);
        window.location.href = 'tel:112';
      }
    }, 30);
    sosTimerRef.current = setTimeout(() => {
      clearInterval(sosProgressRef.current);
    }, duration + 100);
  };

  const handleSosEnd = () => {
    setSosHolding(false);
    setSosProgress(0);
    clearInterval(sosProgressRef.current);
    clearTimeout(sosTimerRef.current);
  };

  useEffect(() => {
    const fetchUsualRide = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/ride/usual-ride`, {
          headers: { token: localStorage.getItem("token") }
        });
        if (response.data && response.data.hasFrequentRide && response.data.frequentRides) {
          setUsualRide(response.data.frequentRides[0]);
        }
      } catch(err) {
        console.warn("Failed to fetch usual ride", err);
      }
    };
    if (token) fetchUsualRide();

    if (navigator.geolocation) {
      updateLocation();
      const locationInterval = setInterval(updateLocation, 5000);
      return () => clearInterval(locationInterval);
    }
  }, [token]);

  const handleLocationChange = useCallback(
    debounce(async (inputValue, token) => {
      if (inputValue.length >= 3) {
        try {
          const response = await axios.get(
            `${import.meta.env.VITE_SERVER_URL}/map/get-suggestions?input=${inputValue}`,
            { headers: { token: localStorage.getItem("token") } }
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

  // Fix for React stale closures in socket events
  const pickupLocationRef = useRef("");
  const destinationLocationRef = useRef("");
  const confirmedRideDataRef = useRef(null);
  const rideStatusRef = useRef("pending");

  useEffect(() => {
    pickupLocationRef.current = pickupLocation;
  }, [pickupLocation]);

  useEffect(() => {
    destinationLocationRef.current = destinationLocation;
  }, [destinationLocation]);

  useEffect(() => {
    confirmedRideDataRef.current = confirmedRideData;
  }, [confirmedRideData]);

  useEffect(() => {
    rideStatusRef.current = rideStatus;
  }, [rideStatus]);

  const onChangeHandler = (e) => {
    setSelectedInput(e.target.id);
    const value = e.target.value;
    if (e.target.id == "pickup") {
      setPickupLocation(value);
    } else if (e.target.id == "destination") {
      setDestinationLocation(value);
    }
    handleLocationChange(value, localStorage.getItem("token"));
    if (e.target.value.length < 3) {
      setLocationSuggestion([]);
    }
  };

  const getDistanceAndFare = async (pickup, destination) => {
    try {
      setLoading(true);
      setTimeoutMessage("");
      const response = await axios.get(
        `${import.meta.env.VITE_SERVER_URL}/ride/get-fare?pickup=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(destination)}`,
        { headers: { token: localStorage.getItem("token") } }
      );
      
      if (response.data && response.data.fastest) {
        setRoutesData(response.data);
        setFare(response.data.fastest.fare);
        setSelectedRouteMode('fastest');

        // Dynamic AI Suggestions from Backend
        setAiSuggestions(response.data.fastest.suggestion);

        // Dynamically fetch nearby Safe Places based on pickup location
        try {
          const coordsRes = await axios.get(
            `${import.meta.env.VITE_SERVER_URL}/map/get-coordinates?address=${encodeURIComponent(pickup)}`,
            { headers: { token: localStorage.getItem("token") } }
          );
          if (coordsRes.data && coordsRes.data.ltd) {
            const placesRes = await axios.get(
              `${import.meta.env.VITE_SERVER_URL}/map/safe-places?lat=${coordsRes.data.ltd}&lng=${coordsRes.data.lng}`,
              { headers: { token: localStorage.getItem("token") } }
            );
            if (placesRes.data && placesRes.data.length > 0) {
              setSafePlacesData({
                message: "Nearby Safe Places",
                places: placesRes.data
              });
            } else {
              setSafePlacesData({
                message: "You are already in a relatively safe area. No emergency spots needed nearby.",
                places: []
              });
            }
          }
        } catch (err) {
          console.error("Safe places error:", err);
          setSafePlacesData({
            message: "You are already in a relatively safe area. No emergency spots needed nearby.",
            places: []
          });
        }

        setShowAISuggestions(true); // Trigger floating UI

        setShowFindTripPanel(false);
        setShowSelectVehiclePanel(true);
      } else {
        alert("Unable to fetch routes. Please check your locations.");
      }
      setLocationSuggestion([]);
      setLoading(false);
    } catch (error) {
      console.error("Route Search Error:", error.response?.data || error.message);
      setLoading(false);
      alert(error.response?.data?.message || "Failed to find routes. Please try again.");
    }
  };

  // Auto-clear timeout messages after 5 seconds
  useEffect(() => {
    let timer;
    if (timeoutMessage) {
      timer = setTimeout(() => {
        setTimeoutMessage("");
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [timeoutMessage]);

  const handleRouteModeChange = (mode) => {
    if (routesData && routesData[mode]) {
      setSelectedRouteMode(mode);
      setFare(routesData[mode].fare);
      
      setAiSuggestions(routesData[mode].suggestion);
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
        { headers: { token: localStorage.getItem("token") } }
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
        { headers: { token: localStorage.getItem("token") } }
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
    setRideStatus("pending");
    setRideCreated(false);
    setRoutesData(null);
  };

  const updateLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentUserLocation({ lat: latitude, lng: longitude });
          setMapLocation(`https://www.google.com/maps?q=${latitude},${longitude}&output=embed`);
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
      if (data?.captain?.location) {
        const origin = `${data.captain.location.coordinates[1]},${data.captain.location.coordinates[0]}`;
        const destination = encodeURIComponent(data.pickup || pickupLocationRef.current);
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API;
        setMapLocation(`https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${origin}&destination=${destination}&mode=driving`);
      }
      // Keep routesData to show the planned path on the JS MapComponent
      setConfirmedRideData(data);
      setRideStatus("accepted");
    });

    socket.on("ride-arrived", (data) => {
        setRideStatus("arrived");
        setMapLocation(`https://www.google.com/maps?q=${encodeURIComponent(data.pickup || pickupLocationRef.current)}&output=embed`);
    });

    socket.on("ride-started", (data) => {
      setRideStatus("ongoing");
      const origin = encodeURIComponent(data.pickup || pickupLocationRef.current);
      const destination = encodeURIComponent(data.destination || destinationLocationRef.current);
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API;
      setMapLocation(`https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${origin}&destination=${destination}&mode=driving`);
    });

    socket.on("captain-location-updated", (data) => {
      const currentRideData = confirmedRideDataRef.current;
      const currentStatus = rideStatusRef.current;

      if (currentRideData) {
        const origin = `${data.location.ltd},${data.location.lng}`;
        // If ride is ongoing, destination is the USER'S destination
        // Otherwise (accepted/arrived), destination is the PICKUP point for the captain to reach
        const targetLocation = currentStatus === "ongoing"
          ? (currentRideData.destination || destinationLocationRef.current)
          : (currentRideData.pickup || pickupLocationRef.current);

        const destination = encodeURIComponent(targetLocation);
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
      setAutoBookingMessage("Saarthi AI is initiating your scheduled ride...");
      
      // Step 1: Set locations so subsequent manual-flow functions use them
      setPickupLocation(task.pickup);
      setDestinationLocation(task.destination);
      
      // Step 2: Fetch routes and fares (Identical to clicking 'Search')
      setAutoBookingMessage("Saarthi AI is calculating the safest/fastest routes...");
      const fareResponse = await axios.get(
        `${import.meta.env.VITE_SERVER_URL}/ride/get-fare?pickup=${encodeURIComponent(task.pickup)}&destination=${encodeURIComponent(task.destination)}`,
        { headers: { token: token } }
      );
      
      if (!fareResponse.data || !fareResponse.data.fastest) {
        throw new Error("Unable to fetch routes for auto-booking");
      }

      setRoutesData(fareResponse.data);
      setFare(fareResponse.data.fastest.fare);
      setSelectedRouteMode('fastest');
      
      // Step 3: Select Vehicle (AI prefers Car for reliability)
      setSelectedVehicle("car");
      
      // Step 4: Create the ride (Identical to clicking 'Confirm Ride')
      setAutoBookingMessage("Saarthi AI is now contacting captains for your arrival...");
      
      const createResponse = await axios.post(
        `${import.meta.env.VITE_SERVER_URL}/ride/create`,
        {
          pickup: task.pickup,
          destination: task.destination,
          vehicleType: "car",
          selectedRouteMode: "fastest",
          genderPreference: rideMode === "female-only" ? "female" : "any",
        },
        { headers: { token: token } }
      );
      
      const rideData = {
        pickup: task.pickup,
        destination: task.destination,
        vehicleType: "car",
        fare: fareResponse.data.fastest.fare.car,
        confirmedRideData: null,
        _id: createResponse.data._id,
      };
      
      localStorage.setItem("rideDetails", JSON.stringify(rideData));
      setRideId(createResponse.data._id);
      
      // Visual transitions
      setShowFindTripPanel(false);
      setShowSelectVehiclePanel(false);
      setShowRideDetailsPanel(true);
      setRideCreated(true);
      setLoading(false);
      
      // Clear AI status message
      setTimeout(() => setAutoBookingMessage(""), 5000);

      // Start longer timeout for no captains
      rideTimeout.current = setTimeout(() => {
        cancelRide();
        setTimeoutMessage("Saarthi AI: No captains available for your scheduled ride. Please try manually.");
      }, 60000); // Increased to 1 minute for better reliability

    } catch (error) {
      Console.error("Agentic AI Workflow failed:", error);
      setLoading(false);
      setAutoBookingMessage("");
      alert("Saarthi AI was unable to book your ride. Please check your connection.");
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
        className={`absolute right-4 top-16 z-[60] p-3 bg-white border border-zinc-100 shadow-xl rounded-full hover:scale-110 active:scale-95 transition-all duration-300 group ${
          rideMode === "female-only" ? "ring-2 ring-pink-400/50 shadow-pink-100" : ""
        }`}
        title="Use Saarthi AI"
      >
        <Sparkles size={24} className={`${rideMode === "female-only" ? "text-pink-600" : "text-blue-600"} transition-colors group-hover:opacity-80`} />
      </button>

      {/* 🆘 SOS Emergency Button — visible only during active ride */}
      {rideStatus === "ongoing" && (
        <div className="absolute left-4 bottom-[24vh] z-[200] flex flex-col items-center gap-1.5">
          {/* Instruction label */}
          <div className={`text-[10px] font-bold text-white px-2 py-0.5 rounded-full transition-all duration-300 ${
            sosHolding ? "bg-red-600 animate-pulse" : "bg-red-500/80"
          }`}>
            {sosHolding ? `Calling 112...` : "Hold for SOS"}
          </div>

          {/* SOS Button */}
          <div className="relative">
            {/* Progress ring */}
            <svg
              className="absolute inset-0 -rotate-90 pointer-events-none"
              width="72" height="72" viewBox="0 0 72 72"
            >
              <circle
                cx="36" cy="36" r="32"
                fill="none"
                stroke="#fca5a5"
                strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 32}`}
                strokeDashoffset={`${2 * Math.PI * 32 * (1 - sosProgress / 100)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.03s linear' }}
              />
            </svg>

            <button
              onMouseDown={handleSosStart}
              onMouseUp={handleSosEnd}
              onMouseLeave={handleSosEnd}
              onTouchStart={handleSosStart}
              onTouchEnd={handleSosEnd}
              className={`relative w-[72px] h-[72px] rounded-full flex flex-col items-center justify-center gap-0.5 shadow-2xl select-none transition-all duration-150 ${
                sosHolding
                  ? "bg-red-600 scale-95 shadow-red-400/60"
                  : "bg-red-500 hover:bg-red-600 active:scale-95 shadow-red-400/40"
              }`}
              title="Hold 2 seconds to call police"
            >
              <ShieldAlert size={22} className="text-white" />
              <span className="text-white text-[10px] font-black tracking-wider">SOS</span>
            </button>
          </div>
        </div>
      )}

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
      <div className={`absolute top-0 left-0 w-full h-full z-0 transition-all duration-300 ${
        rideStatus === "ongoing" ? "scale-105" : ""
      }`}>
          <MapComponent 
            routesData={routesData} 
            selectedMode={selectedRouteMode} 
            onRouteClick={handleRouteModeChange} 
            rideStatus={rideStatus}
            confirmedRideData={confirmedRideData}
            userLocation={currentUserLocation}
          />
      </div>

      {/* Main Panel */}
      <div 
        onClick={() => rideStatus === "ongoing" && setIsExpanded(!isExpanded)}
        className={`absolute bottom-0 w-full rounded-t-[32px] shadow-[0_-12px_40px_rgba(0,0,0,0.1)] z-10 transition-all duration-500 flex flex-col overflow-hidden cursor-pointer ${
          rideStatus === "ongoing" 
            ? (isExpanded ? "h-[80vh]" : "h-[22vh]") 
            : "max-h-[90vh]"
        } ${
          rideMode === "female-only" 
            ? "bg-pink-50/95 border-t-2 border-pink-200" 
            : "bg-white"
        }`}
      >
        {/* Swipe Indicator Part 3 Task 2 */}
        {(rideStatus === "ongoing" || rideStatus === "accepted") && (
          <div className="w-full flex justify-center py-2">
            <div className={`w-12 h-1.5 rounded-full ${rideMode === "female-only" ? "bg-pink-200" : "bg-zinc-200"}`} />
          </div>
        )}
        
        {/* Step 1: Find a trip */}
        {showFindTripPanel && (
          <>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-black">Find a trip</h1>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-zinc-500">Female Only</span>
                  <button 
                    onClick={() => setRideMode(prev => prev === "normal" ? "female-only" : "normal")}
                    className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${
                      rideMode === "female-only" ? "bg-pink-500" : "bg-zinc-200"
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${
                      rideMode === "female-only" ? "translate-x-6" : ""
                    }`} />
                  </button>
                </div>
              </div>

            {usualRide && pickupLocation === "" && destinationLocation === "" && (
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl mb-4 text-sm shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={16} className="text-emerald-600" />
                  <p className="font-bold text-emerald-900 text-sm">Book your usual ride?</p>
                </div>
                <p className="text-emerald-700 font-semibold mb-1 truncate">{usualRide.pickup}</p>
                <div className="flex flex-col gap-1 pl-1 border-l-2 border-emerald-200 ml-1 py-1">
                  <div className="w-1 h-1 rounded-full bg-emerald-400"></div>
                  <div className="w-1 h-1 rounded-full bg-emerald-400"></div>
                </div>
                <p className="text-emerald-700 font-semibold mt-1 mb-3 truncate">{usualRide.destination}</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                       setPickupLocation(usualRide.pickup);
                       setDestinationLocation(usualRide.destination);
                       getDistanceAndFare(usualRide.pickup, usualRide.destination);
                    }}
                    className="flex-1 bg-emerald-600 text-white font-bold py-2 rounded-lg"
                  >
                    YES
                  </button>
                  <button 
                    onClick={() => setUsualRide(null)}
                    className="flex-1 bg-emerald-100 text-emerald-700 font-bold py-2 rounded-lg"
                  >
                    CHANGE
                  </button>
                </div>
              </div>
            )}

            {rideMode === "female-only" && (
              <div className="flex items-center gap-2 mb-4 bg-pink-100/50 p-2 rounded-lg border border-pink-200">
                <div className="w-8 h-8 rounded-full bg-pink-500 flex items-center justify-center">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-pink-700">Saarthi Safe Mode Active</p>
                  <p className="text-[10px] text-pink-600">Exclusive Female Captains & Extra Monitoring</p>
                </div>
              </div>
            )}
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
            </div> {/* Closing the p-6 div here */}

            {pickupLocation.length > 2 && destinationLocation.length > 2 && (
              <div className="mt-4 px-6"> {/* Added px-6 here to maintain padding */}
                <Button
                    title={"Search"}
                    loading={loading}
                    classes={rideMode === "female-only" ? "bg-gradient-to-r from-pink-500 to-pink-600 border-none shadow-lg shadow-pink-200" : "bg-black"}
                    fun={() => getDistanceAndFare(pickupLocation, destinationLocation)}
                />
            </div>
            )}

            <div className="mt-4 max-h-[25vh] overflow-y-auto px-6"> {/* Added px-6 here to maintain padding */}
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
          </>
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
                    selectedVehicle={selectedVehicle}
                    setSelectedVehicle={setSelectedVehicle}
                    setShowPanel={setShowSelectVehiclePanel}
                    showNextPanel={setShowRideDetailsPanel}
                    fare={fare}
                    rideMode={rideMode}
                />
            </div>
          </>
        )}

        {/* Step 3: Ride Details & Confirmation */}
        {showRideDetailsPanel && (
            <div className="overflow-y-auto">
                <RideDetails
                  showPanel={showRideDetailsPanel}
                  setShowPanel={setShowRideDetailsPanel}
                  pickupLocation={pickupLocation}
                  destinationLocation={destinationLocation}
                  selectedVehicle={selectedVehicle}
                  fare={fare}
                  createRide={createRide}
                  cancelRide={cancelRide}
                  loading={loading}
                  rideCreated={rideCreated}
                  confirmedRideData={confirmedRideData}
                  rideStatus={rideStatus}
                  rideMode={rideMode}
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
        onLocationChange={(value) => handleLocationChange(value, localStorage.getItem("token"))}
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
