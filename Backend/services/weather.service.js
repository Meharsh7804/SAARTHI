const axios = require('axios');

/**
 * Weather Service - Fetches real-time weather data
 * API: OpenWeatherMap (Free Tier)
 */
class WeatherService {
    constructor() {
        this.apiKey = process.env.WEATHER_API_KEY;
        this.baseUrl = 'https://api.openweathermap.org/data/2.5/weather';
    }

    /**
     * Get current weather for specific coordinates
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @returns {Object} - Simplified weather object
     */
    async getCurrentWeather(lat, lng) {
        if (!this.apiKey) {
            console.warn("[Weather Service] Missing WEATHER_API_KEY. Falling back to mock data.");
            return { condition: "Clear", isRaining: false, temperature: 25 };
        }

        try {
            const response = await axios.get(this.baseUrl, {
                params: {
                    lat: lat,
                    lon: lng,
                    appid: this.apiKey,
                    units: 'metric'
                }
            });

            const data = response.data;
            const mainCondition = data.weather[0].main;
            
            // Determine if it's "Unfavorable" weather for riding
            const unfavorableConditions = ['Rain', 'Snow', 'Thunderstorm', 'Drizzle', 'Tornado', 'Squall'];
            const isRaining = unfavorableConditions.includes(mainCondition);

            return {
                condition: mainCondition,
                description: data.weather[0].description,
                temperature: data.main.temp,
                isRaining: isRaining,
                humidity: data.main.humidity,
                cityName: data.name
            };
        } catch (error) {
            console.error("[Weather Service] Error fetching weather:", error.message);
            return { condition: "Unknown", isRaining: false, error: true };
        }
    }
}

module.exports = new WeatherService();
