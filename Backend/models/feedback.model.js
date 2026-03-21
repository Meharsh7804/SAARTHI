const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    captain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Captain",
      required: true,
    },
    ride: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
    },
    safetyRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comfortRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    behaviorRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    rideAgain: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Feedback", feedbackSchema);
