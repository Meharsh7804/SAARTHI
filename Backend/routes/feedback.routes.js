const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const feedbackController = require("../controllers/feedback.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.post(
  "/submit",
  authMiddleware.authUser,
  [
    body("rideId").isMongoId().withMessage("Invalid ride ID"),
    body("safetyRating").isInt({ min: 1, max: 5 }).withMessage("Safety rating must be between 1 and 5"),
    body("comfortRating").isInt({ min: 1, max: 5 }).withMessage("Comfort rating must be between 1 and 5"),
    body("behaviorRating").isInt({ min: 1, max: 5 }).withMessage("Behavior rating must be between 1 and 5"),
    body("rideAgain").isBoolean().withMessage("rideAgain must be a boolean"),
  ],
  feedbackController.submitFeedback
);

module.exports = router;
