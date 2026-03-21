# Saarthi - Your Journey, Our Watch 🚗🛡️

Saarthi is a full-stack, real-time ride-sharing application built using the MERN stack. It offers a seamless experience for both users and captains (drivers), with a unique focus on route safety.

## 🌟 Key Features

- **Real-Time Tracking**: Live location updates for captains and real-time ride status synchronization using Socket.io.
- **Safety-First Routing**: Integrated safety score calculation for routes based on local area data.
- **Dual Portals**: Dedicated interfaces and authentication flows for Users and Captains.
- **Interactive Maps**: Full Google Maps integration for address autocomplete, routing, and geocoding.
- **In-App Communication**: Real-time chat system between users and captains during a ride.
- **Secure Authentication**: JWT-based auth with email verification and secure password hashing.
- **Sleek UI**: Modern, responsive design built with React and Tailwind CSS, featuring a custom branded splash screen.

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Lucide React, Socket.io-client.
- **Backend**: Node.js, Express.js, Socket.io, Mongoose.
- **Database**: MongoDB (with GeoSpatial indexing for location-based searches).
- **APIs**: Google Maps Platform (Places, Directions, Distance Matrix, Geocoding).
- **Utilities**: Axios, Bcrypt, JSON Web Token, PapaParse (for safety data processing).

## 🚀 Getting Started

### Prerequisites

- Node.js installed on your machine.
- MongoDB Atlas account or local MongoDB instance.
- Google Maps API Key.

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd SAARTHI
   ```

2. **Backend Setup**:
   ```bash
   cd Backend
   npm install
   ```
   Create a `.env` file in the `Backend` directory:
   ```env
   PORT=4000
   DB_CONNECT=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   GOOGLE_MAPS_API=your_google_maps_api_key
   ```

3. **Frontend Setup**:
   ```bash
   cd ../Frontend
   npm install
   ```
   Create a `.env` file in the `Frontend` directory:
   ```env
   VITE_SERVER_URL=http://localhost:4000
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   VITE_RIDE_TIMEOUT=300000
   ```

### Running the App

1. **Start the Backend**:
   ```bash
   cd Backend
   npm start
   ```

2. **Start the Frontend**:
   ```bash
   cd Frontend
   npm run dev
   ```

## 📂 Project Structure

- `Backend/`: Express server, MongoDB models, socket logic, and safety services.
- `Frontend/`: React source code, reusable components, and global state management.
- `nagpur_safetyscores.csv`: Data source for the route safety feature.

## 🛡️ Safety Feature

Saarthi calculates a safety score for every suggested route by analyzing the areas the route passes through against a verified safety database. Users can choose between the **Fastest** and **Safest** routes for their journey.

---
*Saarthi - Redefining urban mobility with safety and transparency.*
