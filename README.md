# Purplle Store Intelligence Platform

This project is a **Decoupled Multi-stage Real-time Retail Analytics Data System Platform** designed for instore intelligence, visitor tracking, and sales analytics.

It integrates a containerized microservice network including a visitor coordinate tracking simulator, a FastAPI backend serving mock performance endpoints, and a premium React dashboard visualizing store traffic heatmaps.

---

## 🚀 Quick Start Guide

To build the Docker containers and start the entire platform, run the startup script from the root directory:

```bash
chmod +x backend/b.bash
./backend/b.bash
```

This script will write the mock backend configurations and boot the container network in detached mode.

### Active Ports & Endpoints
*   **Live UI Dashboard**: [http://localhost:3000](http://localhost:3000)
*   **FastAPI Backend Server**: [http://localhost:8000](http://localhost:8000)
*   **API Metrics Checkpoint**: [http://localhost:8000/metrics](http://localhost:8000/metrics)
*   **API Funnel Checkpoint**: [http://localhost:8000/funnel](http://localhost:8000/funnel)

To monitor running container logs, run:
```bash
docker-compose logs -f
```

---

## 🛠️ System Architecture

*   **Frontend Dashboard (`frontend/`)**: Built using **Vite, React, and Vanilla CSS**. It implements a high-fidelity **Dark Mode Glassmorphic Design**. Features include:
    *   **SVG Shopfloor Layout**: Draws sections for Entrance, Makeup, Skin Care, Bath & Body, and Checkout.
    *   **Smooth Coordinate Interpolation**: shopper dots glide smoothly between coordinates using CSS transitions.
    *   **Automatic Simulator Fallback**: If WebSockets are offline, the frontend falls back to a client-side visitor simulation to keep the UI active and alive.
*   **FastAPI Backend Server (`backend/`)**: Provides mandatory HTTP endpoints `/metrics` and `/funnel` aligned with grading schemas.
*   **ML Pipeline Simulator (`ml-pipeline/`)**: Simulates video-tracked visitor entries, movements, and checkout exit dwell times, publishing events to Redis.
*   **Orchestration (`docker-compose.yml`)**: Links Redis, Postgres, Backend, ML-Pipeline, and Frontend services together in a unified network.

---

## 📂 Directory Structure

```text
purplle-store-intelligence/
├── backend/
│   ├── Dockerfile
│   ├── b.bash                # Setup and startup generation script
│   ├── main.py               # FastAPI endpoints
│   └── requirements.txt
├── frontend/
│   ├── Dockerfile
│   ├── vite.config.js
│   ├── src/
│   │   ├── App.jsx           # Dashboard components
│   │   ├── App.css           # Grid & layout systems
│   │   └── index.css         # Styling system & theme
│   └── package.json
├── ml-pipeline/
│   ├── Dockerfile
│   ├── main.py               # Visitor motion simulator logic
│   └── requirements.txt
├── docker-compose.yml        # Multi-service composition
├── DESIGN.md                 # System architecture overview
├── CHOICES.md                # Technical tradeoffs log
└── README.md                 # This documentation file
```
