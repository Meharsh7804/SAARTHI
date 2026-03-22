const rideService = require("../services/ride.service");
const { validationResult } = require("express-validator");
const mapService = require("../services/map.service");
const { sendMessageToSocketId } = require("../socket");
const rideModel = require("../models/ride.model");
const userModel = require("../models/user.model");

module.exports.chatDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const ride = await rideModel
      .findOne({ _id: id })
      .populate("user", "socketId fullname phone")
      .populate("captain", "socketId fullname phone");

    if (!ride) {
      return res.status(400).json({ message: "Ride not found" });
    }

    const response = {
      user: {
        socketId: ride.user?.socketId,
        fullname: ride.user?.fullname,
        phone: ride.user?.phone,
        _id: ride.user?._id,
      },
      captain: {
        socketId: ride.captain?.socketId,
        fullname: ride.captain?.fullname,
        phone: ride.captain?.phone,
        _id: ride.captain?._id,
      },
      messages: ride.messages,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports.trackRide = async (req, res) => {
  const { id } = req.params;
  try {
    const ride = await rideModel
      .findOne({ _id: id })
      .populate("captain", "fullname vehicle location phone");
      
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (['completed', 'cancelled'].includes(ride.status)) {
      return res.status(400).json({ message: "Ride tracking link has expired." });
    }

    const trackingData = {
      _id: ride._id,
      pickup: ride.pickup,
      destination: ride.destination,
      status: ride.status,
      captain: ride.captain ? {
        firstname: ride.captain.fullname.firstname,
        vehicle: ride.captain.vehicle,
        location: ride.captain.location,
      } : null,
    };

    res.status(200).json(trackingData);
  } catch (err) {
    res.status(500).json({ message: "Invalid tracking link or server error" });
  }
};

module.exports.createRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { pickup, destination, vehicleType, selectedRouteMode, genderPreference } = req.body;

  try {
    const ride = await rideService.createRide({
      user: req.user._id,
      pickup,
      destination,
      vehicleType,
      selectedRouteMode: selectedRouteMode || 'fastest',
      genderPreference: genderPreference || 'any'
    });

    const user = await userModel.findOne({ _id: req.user._id });
    if (user) {
      user.rides.push(ride._id);
      await user.save();
    }

    res.status(201).json(ride);

    Promise.resolve().then(async () => {
      try {
        const pickupCoordinates = await mapService.getAddressCoordinate(pickup);
        console.log("Pickup Coordinates", pickupCoordinates);

        console.log(`Searching for ${vehicleType} captains within 4km of ${pickup}. Gender pref: ${genderPreference}`);
        const captainsInRadius = await mapService.getCaptainsInTheRadius(
          pickupCoordinates.ltd,
          pickupCoordinates.lng,
          4,
          vehicleType,
          req.user._id,
          genderPreference
        );

        console.log(`Found ${captainsInRadius.length} captains for ride ${ride._id}`);

        ride.otp = "";

        const rideWithUser = await rideModel
          .findOne({ _id: ride._id })
          .populate("user");

        captainsInRadius.map((captain) => {
          console.log(`Sending new-ride to captain: ${captain.fullname.firstname} (Socket: ${captain.socketId})`);
          sendMessageToSocketId(captain.socketId, {
            event: "new-ride",
            data: rideWithUser,
          });
        });
      } catch (e) {
        console.error("Background ride notification failed:", e);
      }
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.getFare = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { pickup, destination } = req.query;

  try {
    const { fastest, safest } = await rideService.getFareWithRoutes(
      pickup,
      destination
    );
    return res.status(200).json({ fastest, safest });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.confirmRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { rideId } = req.body;

  try {
    const rideDetails = await rideModel.findOne({ _id: rideId });

    if (!rideDetails) {
      return res.status(404).json({ message: "Ride not found." });
    }

    switch (rideDetails.status) {
      case "accepted":
        return res
          .status(400)
          .json({
            message:
              "The ride is accepted by another captain before you. Better luck next time.",
          });

      case "ongoing":
        return res
          .status(400)
          .json({
            message: "The ride is currently ongoing with another captain.",
          });

      case "completed":
        return res
          .status(400)
          .json({ message: "The ride has already been completed." });

      case "cancelled":
        return res
          .status(400)
          .json({ message: "The ride has been cancelled." });

      default:
        break;
    }

    const ride = await rideService.confirmRide({
      rideId,
      captain: req.captain,
    });

    if (ride.user && ride.user.socketId) {
      sendMessageToSocketId(ride.user.socketId, {
        event: "ride-confirmed",
        data: ride,
      });
    } else {
      console.warn("User socket ID not found for ride confirmation:", ride._id);
    }

    // TODO: Remove ride from other captains
    // Implement logic here, maybe emit an event or update captain listings

    return res.status(200).json(ride);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.startRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { rideId, otp } = req.query;

  try {
    const ride = await rideService.startRide({
      rideId,
      otp,
      captain: req.captain,
    });

    sendMessageToSocketId(ride.user.socketId, {
      event: "ride-started",
      data: ride,
    });

    return res.status(200).json(ride);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.arrivedRide = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId } = req.body;
    console.log("Arrived Ride Request:", rideId);

    try {
        const ride = await rideService.arrivedRide({ rideId, captain: req.captain });
        console.log("Ride status updated to arrived:", ride._id);

        sendMessageToSocketId(ride.user.socketId, {
            event: "ride-arrived",
            data: ride,
        });

        return res.status(200).json(ride);
    } catch (err) {
        console.log("Arrived Ride Error:", err.message);
        return res.status(500).json({ message: err.message });
    }
};

module.exports.endRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { rideId } = req.body;

  try {
    const ride = await rideService.endRide({ rideId, captain: req.captain });

    sendMessageToSocketId(ride.user.socketId, {
      event: "ride-ended",
      data: ride,
    });

    return res.status(200).json(ride);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.cancelRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { rideId } = req.query;

  try {
    const ride = await rideModel.findOneAndUpdate(
      { _id: rideId },
      {
        status: "cancelled",
      },
      { new: true }
    );

    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    const pickupCoordinates = await mapService.getAddressCoordinate(ride.pickup);
    const captainsInRadius = await mapService.getCaptainsInTheRadius(
      pickupCoordinates.ltd,
      pickupCoordinates.lng,
      4,
      ride.vehicle
    );

    captainsInRadius.map((captain) => {
      sendMessageToSocketId(captain.socketId, {
        event: "ride-cancelled",
        data: ride,
      });
    });
    return res.status(200).json(ride);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
