/**
 * Saarthi AI Assistant Logic (Rule-Based)
 */

export const safePlaces = [
  { name: "Cafe Coffee Day", distance: "200m", type: "cafe" },
  { name: "Police Station Sitabuldi", distance: "500m", type: "police" },
  { name: "Metro Station", distance: "300m", type: "public" },
  { name: "Hospital", distance: "400m", type: "emergency" }
];

/**
 * Get safety suggestion based on time and crime index
 * @param {Object} params - { time, crimeIndex }
 */
export const getSafetySuggestion = ({ time, crimeIndex }) => {
  let riskLevel = "low";
  let message = "Route looks safe. Have a pleasant journey!";

  if (time >= 21 && crimeIndex > 40) {
    riskLevel = "high";
    message = "This area may be unsafe at night. We recommend choosing the safest route or waiting in a secure place.";
  } else if (crimeIndex > 60) {
    riskLevel = "high";
    message = "High crime zone detected. Please prefer safer routes.";
  } else if (crimeIndex > 30) {
    riskLevel = "medium";
    message = "Moderate risk area. Stay alert and follow suggested routes.";
  }

  return { message, riskLevel };
};

/**
 * Get nearby safe places if it's late night
 * @param {Object} params - { time }
 */
export const getSafePlaces = ({ time }) => {
  if (time >= 21 || time < 5) {
    return {
      places: safePlaces.slice(0, 2),
      message: "You can wait at nearby safe locations:"
    };
  }
  return { places: [], message: "" };
};

/**
 * Calculate optimal booking time
 * @param {string} arrivalTimeStr - "HH:mm"
 * @param {number} travelTimeMinutes 
 * @param {number} bufferTime 
 */
export const calculateBookingTime = (arrivalTimeStr, travelTimeMinutes, bufferTime = 5) => {
  const [hours, minutes] = arrivalTimeStr.split(":").map(Number);
  const now = new Date();
  const arrivalDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  
  // If arrival time is in the past, assume it's for tomorrow
  if (arrivalDate < now) {
    arrivalDate.setDate(arrivalDate.getDate() + 1);
  }

  const totalTime = travelTimeMinutes + bufferTime;
  const bookingTime = new Date(arrivalDate.getTime() - totalTime * 60000);

  return bookingTime;
};
