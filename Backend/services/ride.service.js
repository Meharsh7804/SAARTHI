const captainModel = require("../models/captain.model");
const rideModel = require("../models/ride.model");
const mapService = require("./map.service");
const crypto = require("crypto");
const safetyService = require("./safety.service");
const rideHistoryModel = require("../models/rideHistory.model");

const getFare = async (pickup, destination) => {
  if (!pickup || !destination) {
    throw new Error("Pickup and destination are required");
  }

  const distanceTime = await mapService.getDistanceTime(pickup, destination);

  const baseFare = {
    auto: 30,
    car: 50,
    bike: 20,
  };

  const perKmRate = {
    auto: 10,
    car: 15,
    bike: 8,
  };

  const perMinuteRate = {
    auto: 2,
    car: 3,
    bike: 1.5,
  };

  const fare = {
    auto: Math.round(
      baseFare.auto +
        (distanceTime.distance.value / 1000) * perKmRate.auto +
        (distanceTime.duration.value / 60) * perMinuteRate.auto
    ),
    car: Math.round(
      baseFare.car +
        (distanceTime.distance.value / 1000) * perKmRate.car +
        (distanceTime.duration.value / 60) * perMinuteRate.car
    ),
    bike: Math.round(
      baseFare.bike +
        (distanceTime.distance.value / 1000) * perKmRate.bike +
        (distanceTime.duration.value / 60) * perMinuteRate.bike
    ),
  };

  return { fare, distanceTime };
};

module.exports.getFare = getFare;

const { generateSuggestion } = require("../utils/aiSuggestions");

module.exports.getFareWithRoutes = async (pickup, destination) => {
    if (!pickup || !destination) {
        throw new Error("Pickup and destination are required");
    }

    const routes = await mapService.getDetailedRoutes(pickup, destination);

    const processedRoutes = routes.map(route => {
        const leg = route.legs[0];
        const distanceValue = leg.distance.value;
        const durationValue = leg.duration.value;
        
        const segments = safetyService.getSegmentSafetyScores(leg.steps);
        const metrics = safetyService.computeRouteSafetyMetrics(segments);
        const safetyScore = metrics.finalScore;

        const { isNight, hasHighRiskArea } = safetyService.calculateRouteSafety(route);

        const suggestion = generateSuggestion({ 
            distance: distanceValue, 
            duration: durationValue, 
            safetyScore: safetyScore * 10, // scale back to 100 for old logic compatibility if needed
            isNight, 
            hasHighRiskArea 
        });

        const baseFare = { auto: 30, car: 50, bike: 20 };
        const perKmRate = { auto: 10, car: 15, bike: 8 };
        const perMinuteRate = { auto: 2, car: 3, bike: 1.5 };

        const fare = {
            auto: Math.round(baseFare.auto + (distanceValue / 1000) * perKmRate.auto + (durationValue / 60) * perMinuteRate.auto),
            car: Math.round(baseFare.car + (distanceValue / 1000) * perKmRate.car + (durationValue / 60) * perMinuteRate.car),
            bike: Math.round(baseFare.bike + (distanceValue / 1000) * perKmRate.bike + (durationValue / 60) * perMinuteRate.bike),
        };

        return {
            fare,
            distance: leg.distance,
            duration: leg.duration,
            safetyScore,
            unsafeLengthRatio: metrics.unsafeLengthRatio,
            segments,
            suggestion,
            polyline: route.overview_polyline.points,
            summary: route.summary
        };
    });

    if (!processedRoutes || processedRoutes.length === 0) {
        throw new Error("No routes found between these locations. Try being more specific.");
    }

    // Find Fastest
    const fastest = processedRoutes.reduce((prev, curr) =>
        prev.duration.value < curr.duration.value ? prev : curr
    );

    // Find Safest - Part 1, Task 4: Compare multiple routes
    const safest = processedRoutes.reduce((prev, curr) => {
        const scoreDiff = Math.abs(prev.safetyScore - curr.safetyScore);
        if (scoreDiff <= 0.5) { // Using 0.5 as ±5% of 10
            return prev.unsafeLengthRatio < curr.unsafeLengthRatio ? prev : curr;
        }
        return prev.safetyScore > curr.safetyScore ? prev : curr;
    });

    // Pricing Logic: Safest route price = base_price + ₹2 to ₹3 extra
    // We apply this extra cost to the 'safest' route's fare
    safest.fare = {
        auto: safest.fare.auto + 3,
        car: safest.fare.car + 5,
        bike: safest.fare.bike + 2
    };

    return { fastest, safest };
};

function getOtp(num) {
  function generateOtp(num) {
    const otp = crypto
      .randomInt(Math.pow(10, num - 1), Math.pow(10, num))
      .toString();
    return otp;
  }
  return generateOtp(num);
}

module.exports.createRide = async ({
  user,
  pickup,
  destination,
  vehicleType,
  selectedRouteMode = 'fastest',
  genderPreference = 'any'
}) => {
  if (!user || !pickup || !destination || !vehicleType) {
    throw new Error("All fields are required");
  }

  try {
    const response = await module.exports.getFareWithRoutes(pickup, destination);
    const selectedRoute = response[selectedRouteMode];
    const fare = selectedRoute.fare;
    const distanceValue = selectedRoute.distance.value;
    const durationValue = selectedRoute.duration.value;

    const ride = await rideModel.create({
      user,
      pickup,
      destination,
      otp: getOtp(4),
      fare: fare[vehicleType],
      vehicle: vehicleType,
      distance: distanceValue,
      duration: durationValue,
      selectedRouteType: selectedRouteMode,
      genderPreference: genderPreference || 'any'
    });

    // Update RideHistory
    const existingHistory = await rideHistoryModel.findOne({ user, pickup, destination });
    if (existingHistory) {
      existingHistory.count += 1;
      existingHistory.lastBookedAt = Date.now();
      await existingHistory.save();
    } else {
      await rideHistoryModel.create({ user, pickup, destination, count: 1 });
    }

    return ride;
  } catch (error) {
    throw new Error("Error occured while creating ride.");
  }
};

// when ride request is accepted by captain
module.exports.confirmRide = async ({ rideId, captain }) => {
  if (!rideId) {
    throw new Error("Ride id is required");
  }

  try {
    await rideModel.findOneAndUpdate(
      {
        _id: rideId,
      },
      {
        status: "accepted",
        captain: captain._id,
      }
    );

    const ride = await rideModel
      .findOne({
        _id: rideId,
      })
      .populate("user")
      .populate("captain")
      .select("+otp");

    if (!ride) {
      throw new Error("Ride not found after confirmation");
    }

    const captainData = await captainModel.findOne({ _id: captain._id });
    if (!captainData) {
      throw new Error("Captain record not found");
    }

    if (!captainData.rides.includes(rideId)) {
      captainData.rides.push(rideId);
      await captainData.save();
    }

    return ride;
  } catch (error) {
    console.log("Confirm Ride Service Error:", error);
    throw error;
  }
};

module.exports.arrivedRide = async ({ rideId, captain }) => {
    if (!rideId) {
        throw new Error("Ride id is required");
    }

    const ride = await rideModel.findOne({
        _id: rideId,
    }).populate("user").populate("captain");

    if (!ride) {
        throw new Error("Ride not found");
    }

    if (ride.captain._id.toString() !== captain._id.toString()) {
        console.log(`Captain mismatch: Ride captain is ${ride.captain._id}, requesting captain is ${captain._id}`);
        throw new Error("You are not the captain for this ride");
    }

    if (ride.status !== "accepted") {
        console.log(`Arrived Ride Error: Status is ${ride.status}, expected accepted. Ride ID: ${rideId}`);
        throw new Error(`Ride status is ${ride.status}, expected accepted`);
    }

    await rideModel.findOneAndUpdate(
        {
            _id: rideId,
        },
        {
            status: "arrived",
        }
    );

    return ride;
};

module.exports.startRide = async ({ rideId, otp, captain }) => {
  if (!rideId || !otp) {
    throw new Error("Ride id and OTP are required");
  }

  const ride = await rideModel
    .findOne({
      _id: rideId,
    })
    .populate("user")
    .populate("captain")
    .select("+otp");

  if (!ride) {
    throw new Error("Ride not found");
  }

  if (ride.status !== "accepted" && ride.status !== "arrived") {
    throw new Error("Ride not accepted or arrived");
  }

  if (ride.otp !== otp) {
    throw new Error("Invalid OTP");
  }

  await rideModel.findOneAndUpdate(
    {
      _id: rideId,
    },
    {
      status: "ongoing",
    }
  );

  return ride;
};

module.exports.endRide = async ({ rideId, captain }) => {
  if (!rideId) {
    throw new Error("Ride id is required");
  }

  const ride = await rideModel
    .findOne({
      _id: rideId,
      captain: captain._id,
    })
    .populate("user")
    .populate("captain")
    .select("+otp");

  if (!ride) {
    throw new Error("Ride not found");
  }

  if (ride.status !== "ongoing") {
    throw new Error("Ride not ongoing");
  }

  await rideModel.findOneAndUpdate(
    {
      _id: rideId,
    },
    {
      status: "completed",
    }
  );

  return ride;
};
