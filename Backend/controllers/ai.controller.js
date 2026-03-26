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
    // ── Step 1: Call Python AI Service ────────────────────────
    console.log("[Saarthi AI] Sending prompt to AI service:", prompt);

    let aiResponse;
    try {
      aiResponse = await axios.post(`${AI_SERVICE_URL}/extract`, {
        text: prompt,
      }, { timeout: 10000 });
    } catch (aiErr) {
      console.error("[Saarthi AI] AI Service unreachable:", aiErr.message);
      return res.status(503).json({
        message: "AI Service is not running. Please start the Python AI server (uvicorn).",
        error: aiErr.message,
      });
    }

    const { time, drop, source, details } = aiResponse.data;
    console.log("[Saarthi AI] AI Response Received:", { time, drop, source });

    // ── Step 2: Validate extraction ──────────────────────────
    if (!time || !drop) {
      return res.status(422).json({
        message: "Could not understand your request. Please try again with clearer input.",
        extracted: { time, drop, source },
      });
    }

    // ── Step 2.5: Smart Location Matching ────────────────────
    console.log(`[Saarthi AI] Resolving location for "${drop}" biased by pickup "${pickup}"`);
    let resolvedDrop = await mapService.resolveSmartLocation(drop, pickup);
    
    if (resolvedDrop) {
      console.log(`[Saarthi AI] Resolved to: "${resolvedDrop}"`);
    } else {
      console.log(`[Saarthi AI] Could not auto-resolve "${drop}". Falling back to raw extraction.`);
      resolvedDrop = drop;
    }

    // ── Step 3: Parse arrival time ───────────────────────────
    const arrivalTime = parseTimeString(time);
    if (!arrivalTime) {
      return res.status(422).json({
        message: `Could not parse time "${time}". Please use formats like "9:30", "10 AM", etc.`,
        extracted: { time, drop, source },
      });
    }

    // ── Step 4: Get travel time via Google Maps ──────────────
    console.log("[Saarthi AI] Fetching travel time:", pickup, "→", resolvedDrop);
    
    let travelTimeMinutes = 25; // default fallback
    try {
      const distData = await mapService.getDistanceTime(pickup, resolvedDrop);
      if (distData && distData.duration && distData.duration.value) {
        travelTimeMinutes = Math.ceil(distData.duration.value / 60);
      }
    } catch (mapErr) {
      console.warn("[Saarthi AI] Maps API failed, using default travel time:", mapErr.message);
    }

    // ── Step 5: Calculate booking time ───────────────────────
    const BUFFER_MINUTES = 5;
    const now = new Date();
    const arrivalDate = new Date(
      now.getFullYear(), now.getMonth(), now.getDate(),
      arrivalTime.hours, arrivalTime.minutes
    );

    // If arrival time has passed today, assume tomorrow
    if (arrivalDate < now) {
      arrivalDate.setDate(arrivalDate.getDate() + 1);
    }

    const totalLeadTime = travelTimeMinutes + BUFFER_MINUTES;
    const bookingTime = new Date(arrivalDate.getTime() - totalLeadTime * 60000);

    const bookNow = bookingTime <= now;

    console.log("[Saarthi AI] Plan computed:");
    console.log(`  Arrival Time   : ${arrivalDate.toLocaleTimeString()}`);
    console.log(`  Travel Time    : ${travelTimeMinutes} min`);
    console.log(`  Buffer         : ${BUFFER_MINUTES} min`);
    console.log(`  Booking Time   : ${bookingTime.toLocaleTimeString()}`);
    console.log(`  Book Now       : ${bookNow}`);

    // ── Step 6: Return structured plan ───────────────────────
    return res.status(200).json({
      success: true,
      extracted: {
        time: time,
        drop: drop,
        source: source,
      },
      plan: {
        pickup: pickup,
        destination: resolvedDrop,           // <-- SMART MATCH
        originalDestinationQuery: drop, // <-- KEEP ORIGINAL ALIVE 
        arrivalTime: arrivalDate.toISOString(),
        arrivalTimeFormatted: arrivalDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        travelTimeMinutes: travelTimeMinutes,
        bufferMinutes: BUFFER_MINUTES,
        bookingTime: bookingTime.toISOString(),
        bookingTimeFormatted: bookingTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        bookNow: bookNow,
      },
      details: details,
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
