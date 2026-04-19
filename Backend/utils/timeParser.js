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
    let isPM = false;
    let isAM = false;

    // Detect Morning/Afternoon/Evening/Night
    if (text.includes("morning") || text.includes("subah")) {
        isAM = true;
    } else if (text.includes("afternoon") || text.includes("dopahar")) {
        isPM = true;
    } else if (text.includes("evening") || text.includes("sham")) {
        isPM = true;
    } else if (text.includes("night") || text.includes("raat")) {
        isPM = true;
    }

    // Explicit fixes: "raat 8 baje" -> 20:00
    // regex for "raat X baje" or "X baje raat"
    const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje)?/);
    if (timeMatch) {
        hours = parseInt(timeMatch[1]);
        if (timeMatch[2]) minutes = parseInt(timeMatch[2]);
        
        const modifier = (timeMatch[3] || "").toLowerCase();
        if (modifier === "pm") isPM = true;
        if (modifier === "am") isAM = true;

        if (isPM && hours < 12) hours += 12;
        if (isAM && hours === 12) hours = 0;
    }

    // Midnight / Noon
    if (text.includes("midnight")) {
        hours = 0;
        minutes = 0;
        // midnight usually refers to the start of the next day if mentioned now
        const midTime = targetMoment.clone().set({ hour: 0, minute: 0, second: 0 });
        if (midTime.isBefore(moment(currentDateTime))) {
            targetMoment.add(1, 'days');
            normalized.date = targetMoment.format("YYYY-MM-DD");
        }
    } else if (text.includes("noon")) {
        hours = 12;
        minutes = 0;
    }

    // 8 baje (no AM/PM) cases
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

