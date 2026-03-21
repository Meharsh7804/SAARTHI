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
    
    // Combine all step instructions and summaries
    const routeText = (route.summary + ' ' + route.legs.map(leg => 
        leg.steps.map(step => step.html_instructions).join(' ')
    ).join(' ')).toLowerCase();

    safetyData.forEach(item => {
        if (routeText.includes(item.area.toLowerCase())) {
            scores.push(parseInt(item.safety_score));
        }
    });

    // If no specific areas matched, give a default base safety score
    if (scores.length === 0) return 65; 

    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return Math.round(avg);
};

module.exports.getSafetyData = () => safetyData;
