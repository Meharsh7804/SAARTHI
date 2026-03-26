const generateSuggestion = (routeData) => {
    const { distance, duration, safetyScore, isNight, hasHighRiskArea } = routeData;
    
    // Low safety score
    if (safetyScore < 50) {
        if (isNight && hasHighRiskArea) {
            return { message: "This route passes through high-risk areas at night. Proceed with extreme caution or find an alternate route.", riskLevel: "high" };
        } else if (isNight) {
            return { message: "This route is poorly lit or has low safety at night. Proceed with awareness.", riskLevel: "medium" };
        } else {
            return { message: "This route has a lower safety rating. Consider an alternate route or proceed with awareness.", riskLevel: "medium" };
        }
    }
    
    // Medium safety score
    if (safetyScore >= 50 && safetyScore < 75) {
        if (isNight) {
            return { message: "This route has moderate safety at night. Proceed with awareness and consider sharing your trip details.", riskLevel: "medium" };
        } else if (distance > 15000) { // longer than 15km
            return { message: "This is a longer route with moderate safety. Proceed with awareness.", riskLevel: "medium" };
        } else {
            return { message: "This route has moderate safety. Proceed with awareness.", riskLevel: "medium" };
        }
    }
    
    // High safety score
    if (distance > 20000 && isNight) {
        return { message: "This route is considered safe, but it's a long trip at night. Stay alert.", riskLevel: "low" };
    } else {
        return { message: "This route is considered safe. Have a great journey!", riskLevel: "low" };
    }
};

module.exports = { generateSuggestion };
