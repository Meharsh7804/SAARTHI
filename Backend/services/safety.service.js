const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const axios = require('axios');

let safetyData = [];

// Load and parse safety scores on server start or first call
const loadSafetyData = () => {
  const csvPath = path.join(__dirname, '../nagpur_safetyscores.csv');
  const csvFile = fs.readFileSync(csvPath, 'utf8');
  Papa.parse(csvFile, {
    header: true,
    complete: (results) => {
      safetyData = results.data.filter(row => row.area && row.safety_score);
      console.log('Safety data loaded:', safetyData.length, 'areas');
    }
  });
};

loadSafetyData();

/**
 * Approximate safety for a route by checking if areas from CSV are mentioned 
 * in route instructions or steps.
 */
module.exports.calculateRouteSafety = (route) => {
    let scores = [];
    let hasHighRiskArea = false;
    
    // Combine all step instructions and summaries
    const routeText = (route.summary + ' ' + route.legs.map(leg => 
        leg.steps.map(step => step.html_instructions).join(' ')
    ).join(' ')).toLowerCase();

    safetyData.forEach(item => {
        if (routeText.includes(item.area.toLowerCase())) {
            const score = parseInt(item.safety_score);
            scores.push(score);
            if (score <= 40) {
                hasHighRiskArea = true;
            }
        }
    });

    // If no specific areas matched, give a default base safety score
    let baseScore = scores.length === 0 ? 65 : scores.reduce((a, b) => a + b, 0) / scores.length;
    
    // Time of day logic
    const currentHour = new Date().getHours();
    const isNight = currentHour >= 20 || currentHour <= 5; // 8 PM to 5 AM

    if (isNight) {
        baseScore -= 10; // penalty for night
    }

    // Route length logic (penalty for long isolated routes assuming > 15km)
    const distanceMeters = route.legs && route.legs[0] && route.legs[0].distance ? route.legs[0].distance.value : 0;
    if (distanceMeters > 15000) {
        baseScore -= (distanceMeters / 5000); // subtract more for longer routes
    }

    baseScore = Math.max(10, Math.min(100, Math.round(baseScore))); // clamp between 10 and 100

    return { safetyScore: baseScore, isNight, hasHighRiskArea };
};

module.exports.getSafetyData = () => safetyData;
