const axios = require('axios');
const mapService = require('../services/map.service');
const rideHistoryModel = require('../models/rideHistory.model');
const safetyService = require('../services/safety.service');
const { generateSuggestion } = require('../utils/aiSuggestions');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8001";

class RideAgent {
  constructor() {
    this.name = "Saarthi Agent";
  }

  // PART 4: Habit Check first
  async checkUsualRide(userId) {
    if (!userId) return null;
    const history = await rideHistoryModel.find({ user: userId })
      .sort({ count: -1, lastBookedAt: -1 })
      .limit(1);
    
    if (history.length > 0 && history[0].count >= 3) {
      return history[0];
    }
    return null;
  }

  // Step 1: Intent Detection
  async detectIntent(userQuery) {
    const query = userQuery.toLowerCase();
    
    // Call existing NER or our new NLP system
    let extraction = { time: null, drop: null, source: null, details: {}, preference: null };
    try {
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/extract`, { text: userQuery }, { timeout: 10000 });
      let data = aiResponse.data;
      
      if (data.status === "clarification_needed") {
          return { extraction: { time: null, drop: null, preference: null }, intent: "clarification", clarification: data.suggestion };
      }
      
      extraction.time = data.time;
      extraction.drop = data.location;
      extraction.details = data.confidence;
      // We don't have preference from rule-based yet, default to empty
      extraction.preference = null;
    } catch (err) {
      console.warn("[RideAgent] Fallback NER failed", err.message);
    }

    // Rules-based intent, also using neural extraction
    let intent = "book_ride";
    const pref = extraction.preference ? extraction.preference.toLowerCase() : "";
    
    if (pref.includes("safe") || query.includes("safe") || query.includes("secure") || query.includes("protect")) {
      intent = "safest_route";
    } else if (pref.includes("fast") || pref.includes("jaldi") || query.includes("fast") || query.includes("quick") || query.includes("hurry") || query.includes("urgent")) {
      intent = "quick_ride";
    } else if (pref.includes("cheap")) {
      intent = "cheapest_ride";
    }

    return { extraction, intent };
  }

  // Step 2: Goal Mapping
  mapGoal(intent) {
    const map = {
      book_ride: "complete ride booking",
      safest_route: "find safest route",
      quick_ride: "find fastest route",
      cheapest_ride: "find cheapest ride"
    };
    return map[intent] || "complete ride booking";
  }

  // Step 3: Planning
  planActions(goal, context) {
    // Determine the sequence of actions based on the goal
    const actions = [
      "fetch_routes",
      "calculate_safety",
      "fetch_safe_places",
      "suggest_best_option"
    ];
    return actions;
  }

  // Step 4: Execution Engine
  async executeAction(action, context) {
    switch(action) {
      case "fetch_routes": {
         if (!context.pickup || !context.destination) return null;
         try {
           return await mapService.getDetailedRoutes(context.pickup, context.destination);
         } catch (e) {
           return null;
         }
      }
      case "calculate_safety": {
         if(!context.routes) return null;
         return context.routes.map(route => {
            const { safetyScore, isNight, hasHighRiskArea } = safetyService.calculateRouteSafety(route);
            const dist = route.legs[0].distance.value;
            const dur = route.legs[0].duration.value;
            const suggestion = generateSuggestion({ distance: dist, duration: dur, safetyScore, isNight, hasHighRiskArea });
            return { route, safetyScore, suggestion, isNight };
         });
      }
      case "fetch_safe_places": {
         if (!context.pickup) return [];
         try {
           const coords = await mapService.getAddressCoordinate(context.pickup);
           return await mapService.getNearbySafePlaces(coords.ltd, coords.lng);
         } catch(e) {
           return [];
         }
      }
      case "suggest_best_option": {
         if (!context.safetyData || context.safetyData.length === 0) return null;
         
         const fastest = [...context.safetyData].sort((a,b) => a.route.legs[0].duration.value - b.route.legs[0].duration.value)[0];
         const safest = [...context.safetyData].sort((a,b) => b.safetyScore - a.safetyScore)[0];
         
         // Mock Weather & Traffic Data
         const isRaining = Math.random() > 0.8; // 20% chance of rain
         const isHighTraffic = fastest.route.legs[0].duration.value > 1800; // >30m

         let bestRouteType = "optimal";
         let routeData = safest.safetyScore > 50 ? safest : fastest;
         let reason = "I analyzed the available paths.";

         if (context.goal === "find safest route") {
            bestRouteType = "safest"; routeData = safest;
            reason = `I selected the safest route based on your preference. ${safest.suggestion.message}`;
         } else if (context.goal === "find fastest route") {
            bestRouteType = "fastest"; routeData = fastest;
            reason = `I found the fastest route to get you there smartly. ${fastest.suggestion.message}`;
         } else if (context.goal === "find cheapest ride") {
            bestRouteType = "cheapest"; routeData = fastest;
            reason = `I determined the most cost-effective route for you. ${fastest.suggestion.message}`;
         } else {
            // Contextual decision logic
            if (context.isUrgent || isHighTraffic) {
                bestRouteType = "fastest"; routeData = fastest;
                reason = "Traffic is high or time is urgent, so I chose the fastest route.";
            } else if (safest.isNight) {
                bestRouteType = "safest"; routeData = safest;
                reason = "It is currently nighttime or unsafe hours, prioritizing the safest route.";
            } else if (isRaining) {
                bestRouteType = "safest"; routeData = safest;
                reason = "Checking weather: Looks like rain. Choosing safest route to avoid flooded areas.";
            } else {
                bestRouteType = "optimal";
                routeData = safest.safetyScore > 60 ? safest : fastest;
                reason = "I am balancing speed and safety to provide the best overall ride.";
            }
         }

         return {
             bestRouteType,
             routeData,
             reason,
             riskLevel: routeData.suggestion.riskLevel
         };
      }
      default:
         return null;
    }
  }

  async processRequest(userQuery, userContext) {
    // 1. Habit integration
    const usualRide = await this.checkUsualRide(userContext.userId);
    
    const { extraction, intent, clarification } = await this.detectIntent(userQuery);

    if (intent === "clarification") {
       return {
           agentResponse: clarification || "I need more clarification on the location.",
           needsMoreInfo: true,
           extracted: extraction
       };
    }

    // If intent vague and no clear drop location, suggest usual ride
    if (!extraction.drop && !extraction.source && usualRide && userQuery.toLowerCase().includes("usual")) {
       return {
          agentResponse: "Do you want to book your usual ride?",
          isUsualRideSuggestion: true,
          usualRideData: usualRide,
       };
    } else if (!extraction.drop && usualRide && userQuery.trim().length < 15) {
       // Vague intent heuristic
       return {
          agentResponse: "I couldn't detect a clear destination. Would you like to book your usual ride instead?",
          isUsualRideSuggestion: true,
          usualRideData: usualRide,
       };
    }

    if (!extraction.drop) {
        return {
           agentResponse: "I couldn't understand where you want to go. Could you please specify a destination?",
           needsMoreInfo: true,
           extracted: extraction
        };
    }

    // Resolve context location biased by pickup
    const pickup = userContext.pickup;
    let destination = await mapService.resolveSmartLocation(extraction.drop, pickup) || extraction.drop;

    // 2. Map Goal
    const goal = this.mapGoal(intent);
    
    // 3. Plan Actions
    const actions = this.planActions(goal, userContext);

    // Determine urgency
    let isUrgent = false;
    if (extraction.time) {
        // e.g. if the time is within the next 45 mins, mark as urgent
        // For simplicity, we just check if user implicitly asked for jaldi via intent
        if (intent === "quick_ride" || userQuery.toLowerCase().includes("urgent")) {
             isUrgent = true;
        }
    }

    // 4. Execution Engine Loop
    let executionContext = { 
       goal, 
       pickup, 
       destination,
       userId: userContext.userId,
       isUrgent
    };

    let finalSuggestion = null;
    let safePlaces = [];

    for (const action of actions) {
       const result = await this.executeAction(action, executionContext);
       // Append result to context appropriately
       if (action === "fetch_routes" && result) {
          executionContext.routes = result;
       } else if (action === "calculate_safety" && result) {
          executionContext.safetyData = result;
       } else if (action === "fetch_safe_places" && result) {
          safePlaces = result;
       } else if (action === "suggest_best_option" && result) {
          finalSuggestion = result;
       }
    }

    if (!finalSuggestion) {
      return {
         agentResponse: "I'm sorry, I couldn't find a valid route between these locations.",
         failed: true,
         extracted: extraction
      };
    }

    // 5. Response Generation
    return {
       agentResponse: finalSuggestion.reason,
       planDetails: {
          intentDetected: intent,
          goalActive: goal,
          pickup,
          destination,
          extractionTime: extraction.time
       },
       bestOption: finalSuggestion,
       nearbySafePlaces: safePlaces,
       extracted: extraction
    };
  }
}

module.exports = new RideAgent();
