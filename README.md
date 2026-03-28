# StreetPulse: Collective Intelligence Engine

**Detecting collective human discomfort through movement analysis and active community reporting.**

---

## 🏗️ Project Architecture

```bash
streetpulse/
├── client/                     # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/         # MapView (OSRM/Nominatim), SOS Action
│   │   ├── hooks/              # GPS Signal Tracking & Risk Sockets
│   │   └── index.css           # Glassmorphic UI & Design System
├── server/                     # Backend (Node.js + TS)
│   ├── src/
│   │   ├── engine/             # Logic: Anomaly Detection, Risk Scorer, Trust Core
│   │   ├── routes/             # API Endpoints (Signals, Danger Taps)
│   │   └── utils/              # Redis & Supabase Connectors
│   ├── simulate.js             # Traffic/Anomaly Simulation Script
│   └── package.json
└── db/
    └── schema.sql              # PostGIS + H3 Database Schema (Run in Supabase)
```

---

## 🌟 Key Features

*   **Collective Intelligence**: Aggregates passive GPS anomalies (speed drops, re-routes) from multiple users into a live hazard map.
*   **SafeNav Predictive Routing**: Uses **OSRM** to predict if a path intersects dangerous H3 hex zones and suggests alternatives.
*   **Nominatim Search**: Integrated global location search via OpenStreetMap (100% Free).
*   **Zero-Cost SOS**: Native **Web Share API** integration to blast rescue payloads to emergency contacts without paid SMS.
*   **Reputation Core**: A trust-based backend that weights user reports based on historical accuracy to prevent spam.

---

## 🔑 Required Configuration (.env)

### Backend Requirements (`/server/.env`)
*   `PORT=3001`
*   `SUPABASE_URL`: Your Supabase project URL.
*   `SUPABASE_KEY`: Your Supabase Service/Anon key.
*   `REDIS_URL`: `redis://default:password@hostname:port` (Used for rate-limiting).

### Frontend Requirements (`/client/.env`)
*   `VITE_API_URL`: Your backend URL (e.g., `http://localhost:3001`).
*   `VITE_WS_URL`: Your websocket URL (e.g., `http://localhost:3001`).

---

## 🚀 Getting Started

1.  **Initialize Database**: Execute the contents of `db/schema.sql` in your Supabase SQL Editor.
2.  **Install Dependencies**: 
    ```bash
    cd client && npm install
    cd ../server && npm install
    ```
3.  **Run Development Mode**:
    *   **Server**: `npm run dev` (inside `/server`)
    *   **Client**: `npm run dev` (inside `/client`)
4.  **Test Live Data**: Open `http://localhost:5173`. Run `node server/simulate.js` to populate the map with simulated hazards.

---

*Engineered for community safety. Zero operating costs.*
