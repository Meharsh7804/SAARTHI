const moment = require('moment-timezone');

/**
 * Robust Natural Language Time Parser Layer
 * Handles Hindi (Hinglish) and English time/date terms deterministically.
 */

function normalizeTime(inputText, currentDateTime = new Date(), userLocale = "en-IN") {
    const text = inputText.toLowerCase();
    let normalized = {
        date: null,
        time: null,
        recurrence: null
    };

    // ── RECURRENCE HANDLING ─────────────────────────────
    const recurrenceKeywords = ["daily", "हर दिन", "roz", "everyday", "every day"];
    if (recurrenceKeywords.some(kw => text.includes(kw))) {
        normalized.recurrence = "DAILY";
    }

    // ── DATE UNDERSTANDING ──────────────────────────────
    let targetMoment = moment(currentDateTime).tz("Asia/Kolkata");

    if (text.includes("day after tomorrow")) {
        targetMoment.add(2, 'days');
    } else if (text.includes("tomorrow") || text.includes("kal")) {
        // Hindi ambiguity: default to tomorrow for booking bias
        targetMoment.add(1, 'days');
    } else if (text.includes("today") || text.includes("aaj")) {
        // Keep today
    }

    normalized.date = targetMoment.format("YYYY-MM-DD");

    // ── TIME NORMALIZATION ──────────────────────────────
    let hours = null;
    let minutes = 0;

    // STEP 1: EXTRACT HOURS + MINUTES
    // Detect patterns: "12 30", "12:30", "12.30", "1230", "7"
    const timeRegex = /(?:(\d{1,2})[\s.:](\d{1,2}))|(?:(\d{2})(\d{2}))|(\d{1,2})/;
    const timeMatch = text.match(timeRegex);

    if (timeMatch) {
        if (timeMatch[1] !== undefined) {
            // format: HH[\s.:]MM (e.g., 12 30, 12:30, 12.30)
            hours = parseInt(timeMatch[1]);
            minutes = parseInt(timeMatch[2]);
        } else if (timeMatch[3] !== undefined) {
            // format: HHMM (e.g., 1230)
            hours = parseInt(timeMatch[3]);
            minutes = parseInt(timeMatch[4]);
        } else if (timeMatch[5] !== undefined) {
            // format: HH (e.g., 7)
            hours = parseInt(timeMatch[5]);
            minutes = 0;
        }
    }

    // Handle context-based AM/PM flags
    // Step 2 Keywords: morning -> AM, afternoon/evening/night/raat -> PM
    let isPM = text.includes("pm") || text.includes("afternoon") || text.includes("dopahar") || 
               text.includes("evening") || text.includes("sham") || 
               text.includes("night") || text.includes("raat");
    let isAM = text.includes("am") || text.includes("morning") || text.includes("subah");

    // Special cases: Midnight / Noon
    if (/\bmidnight\b/.test(text)) {
        hours = 0;
        minutes = 0;
        isAM = true;
    } else if (/\bnoon\b/.test(text)) {
        hours = 12;
        minutes = 0;
        isPM = true;
    }

    // STEP 2 & 3: HANDLE TIME CONTEXT AND 12 EDGE CASE
    if (hours !== null) {
        if (hours === 12) {
            // 12 AM logic: night/raat/morning/am -> 00:MM
            if (text.includes("night") || text.includes("raat") || isAM) {
                hours = 0;
            }
            // 12 PM logic: 12 afternoon/noon/evening/pm stays 12
        } else if (hours < 12) {
            // PM conversion: afternoon/evening/night/pm -> +12
            if (isPM) {
                hours += 12;
            }
        }
    }

    // 8 baje (no AM/PM) cases - Date adjustment
    if (hours !== null && !isAM && !isPM && !text.includes("am") && !text.includes("pm")) {
        const testTime = targetMoment.clone().set({ hour: hours, minute: minutes });
        
        if (testTime.isBefore(moment(currentDateTime))) {
            // If current time < hours -> assume same day (e.g. now 7, req 8 -> 8 today)
            // else -> next day 8
            if (moment(currentDateTime).hour() >= hours) {
                targetMoment.add(1, 'days');
                normalized.date = targetMoment.format("YYYY-MM-DD");
            }
        }
    }

    if (hours !== null) {
        normalized.time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        // Final sanity check: If the resolved date + time is in the past, roll over to the next day
        // unless a specific relative date was mentioned like "today" or "tomorrow"
        const finalMoment = moment(normalized.date + " " + normalized.time, "YYYY-MM-DD HH:mm").tz("Asia/Kolkata");
        const now = moment().tz("Asia/Kolkata");
        
        // If it's a future-biased use case (booking), it should never be in the past
        if (finalMoment.isBefore(now)) {
            // Only roll over if the user didn't explicitly say "today" or "aaj"
            if (!text.includes("today") && !text.includes("aaj")) {
                finalMoment.add(1, 'days');
                normalized.date = finalMoment.format("YYYY-MM-DD");
            }
        }
    }

    console.log(`[TimeParser] Input: "${inputText}" -> Result: ${JSON.stringify(normalized)}`);
    return normalized;
}

module.exports = { normalizeTime };

