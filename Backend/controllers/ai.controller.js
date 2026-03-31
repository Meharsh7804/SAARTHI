/**
 * ===========================================================
 * ai.controller.js  –  Saarthi AI Integration Controller
 * ===========================================================
 * Connects the Node/Express backend to the Python AI Service.
 * 
 * Endpoint: POST /ai/extract-and-plan
 *   → Calls Python AI (FastAPI) /extract
 *   → Returns extracted { time, drop, source }
 *   → Calculates bookingTime based on travel estimates
 * ===========================================================
 */

const axios = require("axios");
const mapService = require("../services/map.service");
const rideAgent = require("../agent/rideAgent");

// Python AI service URL (FastAPI on port 8001)
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8001";

/**
 * POST /ai/extract-and-plan
 * Body: { prompt: string, pickup: string }
 * 
 * Flow:
 *   1. Send prompt text to Python AI → extract TIME + DROP
 *   2. Use Google Maps to get travel time from pickup → drop
 *   3. Calculate optimal booking time
 *   4. Return full plan to frontend
 */
module.exports.extractAndPlan = async (req, res) => {
  const { prompt, pickup } = req.body;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ message: "Prompt text is required." });
  }

  if (!pickup || !pickup.trim()) {
    return res.status(400).json({ message: "Pickup location is required." });
  }

  try {
    const userContext = { userId: req.user._id, pickup };
    
    // ── Call Agent Workflow ──────────────────────────────
    const agentResponse = await rideAgent.processRequest(prompt, userContext);

    if (agentResponse.isUsualRideSuggestion) {
       return res.status(200).json({
          success: true,
          isUsualRide: true,
          agentMessage: agentResponse.agentResponse,
          usualRideData: agentResponse.usualRideData
       });
    }

    if (agentResponse.needsMoreInfo || agentResponse.failed) {
       return res.status(422).json({
          message: agentResponse.agentResponse || "Could not process request",
          extracted: agentResponse.extracted
       });
    }

    const { planDetails, bestOption, nearbySafePlaces, extracted } = agentResponse;
    const time = planDetails.extractionTime;

    // ── Time Parsing & Booking Time Calculation ─────────
    const arrivalTime = parseTimeString(time);
    let arrivalDate = new Date();
    let bookingTime = new Date();
    let bookNow = true;
    let travelTimeMinutes = 25;
    let BUFFER_MINUTES = 5;

    if (arrivalTime) {
      const now = new Date();
      arrivalDate = new Date(
        now.getFullYear(), now.getMonth(), now.getDate(),
        arrivalTime.hours, arrivalTime.minutes
      );
      if (arrivalDate < now) {
        arrivalDate.setDate(arrivalDate.getDate() + 1);
      }

      const distData = bestOption.routeData.route.legs[0];
      travelTimeMinutes = Math.ceil(distData.duration.value / 60);

      const totalLeadTime = travelTimeMinutes + BUFFER_MINUTES;
      bookingTime = new Date(arrivalDate.getTime() - totalLeadTime * 60000);
      bookNow = bookingTime <= now;
    }

    // ── Return structured plan ───────────────────────
    return res.status(200).json({
      success: true,
      extracted: extracted,
      agentInfo: {
        message: agentResponse.agentResponse,
        intent: planDetails.intentDetected,
        goal: planDetails.goalActive,
        riskLevel: bestOption.riskLevel,
        safePlaces: nearbySafePlaces
      },
      plan: {
        pickup: planDetails.pickup,
        destination: planDetails.destination,
        originalDestinationQuery: extracted.drop,
        arrivalTime: arrivalTime ? arrivalDate.toISOString() : null,
        arrivalTimeFormatted: arrivalTime ? arrivalDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : null,
        travelTimeMinutes: travelTimeMinutes,
        bufferMinutes: BUFFER_MINUTES,
        bookingTime: arrivalTime ? bookingTime.toISOString() : null,
        bookingTimeFormatted: arrivalTime ? bookingTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : null,
        bookNow: bookNow,
        routeType: bestOption.bestRouteType
      },
      details: extracted.details,
    });

  } catch (err) {
    console.error("[Saarthi AI] Unexpected error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};


/**
 * Parse a natural-language time string into { hours, minutes }.
 * Handles: "9:30", "9.30", "9 30", "10 AM", "9:30 PM", "subah 9:30", etc.
 */
function parseTimeString(timeStr) {
  if (!timeStr) return null;

  let cleaned = timeStr
    .toLowerCase()
    .replace(/subah|morning|sham|evening|raat|night|dopahar|afternoon|baje|tak|ko|around|exactly|approx/gi, "")
    .trim();

  let isPM = false;
  let isAM = false;

  if (/pm/i.test(cleaned)) { isPM = true; cleaned = cleaned.replace(/pm/i, "").trim(); }
  if (/am/i.test(cleaned)) { isAM = true; cleaned = cleaned.replace(/am/i, "").trim(); }

  // Try HH:MM, HH.MM, HH MM patterns
  let match = cleaned.match(/(\d{1,2})\s*[:.\s]\s*(\d{1,2})/);
  if (match) {
    let hours = parseInt(match[1]);
    let minutes = parseInt(match[2]);

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return { hours, minutes };
    }
  }

  // Try single number (e.g., "10", "9")
  match = cleaned.match(/(\d{1,2})/);
  if (match) {
    let hours = parseInt(match[1]);
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    if (hours >= 0 && hours <= 23) {
      return { hours, minutes: 0 };
    }
  }

  return null;
}
