const mapService = require("../services/map.service");
const { validationResult } = require("express-validator");

module.exports.getCoordinates = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { address } = req.query;

  try {
    const coordinates = await mapService.getAddressCoordinate(address);
    res.status(200).json(coordinates);
  } catch (error) {
    res.status(404).json({ message: "Coordinates not found", error: error });
  }
};

module.exports.getDistanceTime = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { origin, destination } = req.query;

    const distanceTime = await mapService.getDistanceTime(origin, destination);

    res.status(200).json(distanceTime);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getAutoCompleteSuggestions = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { input } = req.query;

    const suggestions = await mapService.getAutoCompleteSuggestions(input);

    res.status(200).json(suggestions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.getSafePlaces = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ message: "Latitude and longitude are required" });
    }

    const places = await mapService.getNearbySafePlaces(parseFloat(lat), parseFloat(lng));
    
    res.status(200).json(places);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};
module.exports.getRouteSafety = async (req, res) => {
  try {
    const { segments } = req.body;
    
    if (!segments || !Array.isArray(segments)) {
        return res.status(400).json({ message: "Segments (array) are required" });
    }

    const scores = await mapService.getRouteSafetyScores(segments);
    
    res.status(200).json({ segments: scores });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};
