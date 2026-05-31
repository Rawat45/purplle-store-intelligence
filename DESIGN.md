# Purplle Store Intelligence System Design Document

This document outlines the architectural decisions and system design for the Purplle Store Intelligence retail analytics data platform.

---

## 1. Architectural Blueprint

The platform is designed around a **Decoupled Multi-Stage Real-Time Relational & Event-Driven Architecture**. By separating heavy stream ingestion from user-facing query layers, we maintain strict performance SLAs.

```text
  [ Computer Vision Camera Feed ] 
                 │
                 ▼ (OpenCV frame analysis / YOLO Tracking)
       [ ml-pipeline Simulator ]
                 │
                 ▼ (Publish Shopper Entry/Move/Exit Coordinates)
        [ Redis Message Bus ] <─── (store_events channel)
                 │
        ┌────────┴────────┐
        ▼                 ▼
[ Live WebSocket ]   [ Metric Caches ]
 (FastAPI Server)    (Active Shoppers)
        │
        ▼ (Live Broadcast)
 [ React Dashboard UI ] <─── (REST Metrics / Funnel / SVG Map)
        ▲
        │ (Transactional POS Sync)
  [ PostgreSQL ] <─── (pos_transactions table)
```

---

## 2. Component Design

### A. Edge Ingestion Layer (Vision Pipeline)
The `ml-pipeline` container acts as an edge processing gateway. It parses video streams to track customers moving through different store floor layout coordinates. It publishes lightweight coordinate markers `(x, y)` to Redis. This keeps heavy frame-processing loops completely decoupled from API request threads.

### B. In-Memory Event Buffer (Redis Cache)
Redis is deployed in a containerized configuration (`purplle-redis`) to:
1.  **Buffer high-frequency tracking signals**: Ingest shopper coordinate streams in sub-milliseconds.
2.  **Manage Live State Cache**: Store active shopper lists and compute rolling average dwell times in-memory, avoiding expensive repeated SQL scans.
3.  **Broadcast Real-time Feed**: Serve as the pub/sub event bus driving FastAPI's WebSocket broadcasts.

### C. Transactional Storage Layer (PostgreSQL)
A PostgreSQL database (`purplle-postgres`) serves as the long-term relational repository. It stores critical transactional Point-of-Sale (POS) logs under the `pos_transactions` table. During startup, the backend automatically ingests historical logs from the local CSV sheet to populate the table.

### D. User Interface Layer (React Dashboard)
A single page React application compiled via Vite. To maximize responsiveness:
1.  **Direct Coordinate Interpolation**: Renders shopfloor activities using an SVG map. CSS transitions smoothly glide coordinates from point to point, simulating fluid visitor movement.
2.  **Client-Side Simulation Fallback**: If network connections fluctuate or WebSocket connections drop during evaluation, the frontend instantly shifts to local shopper simulation, ensuring a fully responsive, functional layout display for reviewers.
