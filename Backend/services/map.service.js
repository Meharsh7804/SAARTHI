const axios = require("axios");
const captainModel = require("../models/captain.model");
const userModel = require("../models/user.model");

module.exports.getAddressCoordinate = async (address) => {
  const apiKey = process.env.GOOGLE_MAPS_API;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${apiKey}`;

  try {
    const response = await axios.get(url);
    if (response.data.status === "OK") {
      const location = response.data.results[0].geometry.location;
      return {
        ltd: location.lat,
        lng: location.lng,
      };
    } else {
      throw new Error("Unable to fetch coordinates");
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
};

module.exports.getDistanceTime = async (origin, destination) => {
  if (!origin || !destination) {
    throw new Error("Origin and destination are required");
  }
  const apiKey = process.env.GOOGLE_MAPS_API;

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
    origin
  )}&destinations=${encodeURIComponent(destination)}&key=${apiKey}`;

  try {
    const response = await axios.get(url);
    if (response.data.status === "OK") {
      if (response.data.rows[0].elements[0].status === "ZERO_RESULTS") {
        throw new Error("No routes found");
      }

      return response.data.rows[0].elements[0];
    } else {
      throw new Error("Unable to fetch distance and time");
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
};

module.exports.getAutoCompleteSuggestions = async (input) => {
  if (!input) {
    throw new Error("query is required");
  }

  const apiKey = process.env.GOOGLE_MAPS_API;
  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
    input
  )}&key=${apiKey}`;

  try {
    const response = await axios.get(url);
    if (response.data.status === "OK") {
      return response.data.predictions
        .map((prediction) => prediction.description)
        .filter((value) => value);
    } else {
      throw new Error("Unable to fetch suggestions");
    }
  } catch (err) {
    console.log(err.message);
    throw err;
  }
};

module.exports.getDetailedRoutes = async (origin, destination) => {
    if (!origin || !destination) {
        throw new Error("Origin and destination are required");
    }
    const apiKey = process.env.GOOGLE_MAPS_API;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
        origin
    )}&destination=${encodeURIComponent(destination)}&alternatives=true&key=${apiKey}`;

    try {
        const response = await axios.get(url);
        if (response.data.status === "OK") {
            return response.data.routes;
        } else if (response.data.status === "ZERO_RESULTS") {
            throw new Error("No driving route found between these locations.");
        } else {
            console.error(response.data.status, response.data.error_message || "Google API failure");
            throw new Error(`Maps Error: ${response.data.status}. ${response.data.error_message || ""}`);
        }
    } catch (err) {
        console.error(err);
        throw err;
    }
};

module.exports.getCaptainsInTheRadius = async (ltd, lng, radius, vehicleType, userId = null, gender = null) => {
  // radius in km
  
  try {
    const query = {
      location: {
        $geoWithin: {
          $centerSphere: [[lng, ltd], radius / 6371],
        },
      },
      "vehicle.type": vehicleType,
      // status: "active",
    };

    if (gender && gender !== 'any') {
      query.gender = gender;
    }

    const captains = await captainModel.find(query);

    if (!userId) {
      return captains.sort((a, b) => (b.avgSafetyScore || 0) - (a.avgSafetyScore || 0));
    }

    const user = await userModel.findById(userId);
    const preferredDriverIds = user?.preferredDrivers?.map(id => id.toString()) || [];

    return captains.sort((a, b) => {
      const aIsPreferred = preferredDriverIds.includes(a._id.toString());
      const bIsPreferred = preferredDriverIds.includes(b._id.toString());

      if (aIsPreferred && !bIsPreferred) return -1;
      if (!aIsPreferred && bIsPreferred) return 1;

      return (b.avgSafetyScore || 0) - (a.avgSafetyScore || 0);
    });
  } catch (error) {
    throw new Error("Error in getting captain in radius: " + error.message);
  }
};

module.exports.resolveSmartLocation = async (extractedLocation, pickupLocationStr) => {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API;
    if (!extractedLocation) return null;

    let locationBias = "";
    // If pickup isn't just "Current Location", try to get coords for biasing
    if (pickupLocationStr && pickupLocationStr !== "Current Location") {
      // Check if it's already "lat, lng" format
      if (pickupLocationStr.match(/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/)) {
        locationBias = `&location=${pickupLocationStr.replace(/\s/g, '')}&radius=15000`;
      } else {
        try {
          const coords = await module.exports.getAddressCoordinate(pickupLocationStr);
          locationBias = `&location=${coords.ltd},${coords.lng}&radius=15000`;
        } catch (e) {
          console.warn("[Map Service] Could not get coords for pickup, searching without bias.");
        }
      }
    }

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(extractedLocation)}${locationBias}&key=${apiKey}`;
    const response = await axios.get(url);

    if (response.data.status === "OK" && response.data.predictions && response.data.predictions.length > 0) {
      // Return the best match's full description
      return response.data.predictions[0].description;
    }
    return null;
  } catch (err) {
    console.error("[Map Service] resolveSmartLocation error:", err.message);
    return null;
  }
};

module.exports.getNearbySafePlaces = async (ltd, lng, radius = 2000) => {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API;
    const types = ["police", "hospital", "pharmacy", "gas_station"];
    const typeString = types.join("|");
    
    // Using Place Search API (Nearby Search)
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${ltd},${lng}&radius=${radius}&type=${typeString}&key=${apiKey}`;
    
    const response = await axios.get(url);
    
    if (response.data.status === "OK") {
      // Format and calculate approximate distance
      const places = response.data.results.slice(0, 5).map(place => {
        // Approximate distance based on radius ratio (since exact distance isn't provided by nearby search natively)
        // Or we can just calculate bird flight distance
        const pLtd = place.geometry.location.lat;
        const pLng = place.geometry.location.lng;
        
        // Haversine formula
        const R = 6371; // km
        const dLat = (pLtd - ltd) * Math.PI / 180;
        const dLon = (pLng - lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(ltd * Math.PI / 180) * Math.cos(pLtd * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distanceKm = R * c;
        const distanceStr = distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m away` : `${distanceKm.toFixed(1)}km away`;
        
        let typeLabel = "Safe Place";
        if (place.types.includes("police")) typeLabel = "Police Station";
        else if (place.types.includes("hospital")) typeLabel = "Hospital";
        else if (place.types.includes("pharmacy")) typeLabel = "Pharmacy (24x7)";
        else if (place.types.includes("gas_station")) typeLabel = "Petrol Pump";

        return {
          name: place.name,
          type: typeLabel,
          distance: distanceStr,
          distanceKm: distanceKm,
          lat: pLtd,
          lng: pLng
        };
      });

      // Sort by distance
      places.sort((a, b) => a.distanceKm - b.distanceKm);

      return places.slice(0, 3); // top 3
    }
    
    return [];
  } catch (error) {
    console.error("[Map Service] Error fetching safe places:", error.message);
    return []; // fallback to empty array
  }
};

module.exports.getRouteSafetyScores = async (segments) => {
  // Mock safety scores (0-10)
  // Stable "random" based on coords for consistency
  return segments.map(seg => {
    const seed = (seg.lat * 10000 + seg.lng * 10000) % 1;
    // To make it look real, use a weighted random or area based if possible
    // Let's just use semi-stable random for mock
    const pseudoRandom = Math.abs(Math.sin(seg.lat * 12.9898 + seg.lng * 78.233)) * 10;
    return {
      ...seg,
      safety_score: Math.floor(pseudoRandom % 11)
    };
  });
};
