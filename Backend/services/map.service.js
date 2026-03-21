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
        } else {
            console.error(response.data.status, response.data.error_message);
            throw new Error("Unable to fetch detailed routes");
        }
    } catch (err) {
        console.error(err);
        throw err;
    }
};

module.exports.getCaptainsInTheRadius = async (ltd, lng, radius, vehicleType, userId = null) => {
  // radius in km
  
  try {
    const captains = await captainModel.find({
      location: {
        $geoWithin: {
          $centerSphere: [[lng, ltd], radius / 6371],
        },
      },
      "vehicle.type": vehicleType,
      // status: "active",
    });

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
