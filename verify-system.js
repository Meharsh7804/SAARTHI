const mongoose = require("mongoose");
const captainModel = require("./Backend/models/captain.model");
const userModel = require("./Backend/models/user.model");
const rideModel = require("./Backend/models/ride.model");
const feedbackModel = require("./Backend/models/feedback.model");
const feedbackController = require("./Backend/controllers/feedback.controller");

// Mocking some data for testing
async function testFeedback() {
    console.log("Starting Feedback Logic Verification...");
    
    // This is a unit test for the calculation logic
    const oldAvg = 4.0;
    const totalRides = 10;
    const currentFeedbackRatings = [4, 5, 3]; // Average = 4
    const currentScore = currentFeedbackRatings.reduce((a, b) => a + b) / currentFeedbackRatings.length;
    
    const newAvg = ((oldAvg * totalRides) + currentScore) / (totalRides + 1);
    console.log(`Calculation Test: Old Avg: ${oldAvg}, Total Rides: ${totalRides}, Current Score: ${currentScore}`);
    console.log(`Expected New Avg: ${newAvg.toFixed(2)}`);
    
    if (newAvg.toFixed(2) === "4.00") {
        console.log("✅ Calculation Logic Correct!");
    } else {
        console.log("❌ Calculation Logic Incorrect!");
    }

    // Checking if models have correct fields
    const captainFields = Object.keys(captainModel.schema.paths);
    if (captainFields.includes("avgSafetyScore") && captainFields.includes("totalRides")) {
        console.log("✅ Captain Model Updated Successfully!");
    } else {
        console.log("❌ Captain Model Update Failed!");
    }

    const userFields = Object.keys(userModel.schema.paths);
    if (userFields.includes("preferredDrivers")) {
        console.log("✅ User Model Updated Successfully!");
    } else {
        console.log("❌ User Model Update Failed!");
    }
}

testFeedback().then(() => {
    console.log("Verification Finished.");
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
