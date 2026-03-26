/**
 * ===========================================================
 * ai.routes.js  –  Saarthi AI Routes
 * ===========================================================
 */

const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const aiController = require("../controllers/ai.controller");
const authMiddleware = require("../middlewares/auth.middleware");

/**
 * POST /ai/extract-and-plan
 * 
 * Calls Python AI service to extract TIME + DROP from natural language,
 * then computes an optimal booking time.
 * 
 * Body: { prompt: string, pickup: string }
 */
router.post(
  "/extract-and-plan",
  authMiddleware.authUser,
  body("prompt").isString().isLength({ min: 3 }).withMessage("Prompt text must be at least 3 characters"),
  body("pickup").isString().isLength({ min: 3 }).withMessage("Pickup location is required"),
  aiController.extractAndPlan
);

module.exports = router;
