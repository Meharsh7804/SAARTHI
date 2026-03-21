const feedbackModel = require("../models/feedback.model");
const captainModel = require("../models/captain.model");
const userModel = require("../models/user.model");
const rideModel = require("../models/ride.model");
const { validationResult } = require("express-validator");

module.exports.submitFeedback = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { rideId, safetyRating, comfortRating, behaviorRating, rideAgain } = req.body;

  try {
    const ride = await rideModel.findById(rideId).populate("captain");
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (ride.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized to provide feedback for this ride" });
    }

    const captain = await captainModel.findById(ride.captain._id);
    if (!captain) {
      return res.status(404).json({ message: "Captain not found" });
    }

    // Save feedback
    const feedback = await feedbackModel.create({
      user: req.user._id,
      captain: captain._id,
      ride: rideId,
      safetyRating,
      comfortRating,
      behaviorRating,
      rideAgain,
    });

    // Calculate current feedback score
    const currentScore = (safetyRating + comfortRating + behaviorRating) / 3;

    // Update driver's average safety score
    const oldAvg = captain.avgSafetyScore || 0;
    const totalRides = captain.totalRides || 0;
    const newAvg = ((oldAvg * totalRides) + currentScore) / (totalRides + 1);

    captain.avgSafetyScore = parseFloat(newAvg.toFixed(2));
    captain.totalRides += 1;
    await captain.save();

    // Update user preferences if rideAgain is true
    if (rideAgain) {
      await userModel.findByIdAndUpdate(req.user._id, {
        $addToSet: { preferredDrivers: captain._id }
      });
    }

    res.status(201).json({ message: "Feedback submitted successfully", feedback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
