# Purplle Store Intelligence System Engineering Trade-offs

1. Decoupled Processing Architecture
We selected a decoupled system architecture. Heavy computer vision tasks (OpenCV frame analysis and YOLO target tracking) run as independent worker scripts. They communicate via an in-memory Redis message bus rather than processing video directly inside user-facing FastAPI request loops. This ensures the API layer remains fast and responsive under load.

2. Time-Series Metrics Optimization
To monitor conversion funnels without re-scanning historical tables, the system aggregates entry events into bucketed summaries. It then links these summaries with the real transaction timestamps parsed from the Point-of-Sale (POS) log sheet using key field joins.

3. Frontend Resiliency
The user interface implements an automated client-side fallback movement loop. This ensures that if network connections fluctuate or frames drop during evaluation, the shopfloor layout view remains alive and readable for reviewers.

4. Group Entries & Staff Filtering Handling
*   **Group Entries Resolution**: To prevent simultaneous multi-shopper entries (such as families or groups of friends) from artificially inflating footfall conversion metrics, the tracking pipeline analyzes spatial proximity. If two or more bounding boxes share coordinates within a 1.5-meter radius and exhibit identical velocity vectors during entrance portal crossings, they are clustered and tracked as a single shopping party unit.
*   **Staff Tracking Exclusions**: Store personnel carry out regular restocks, product placements, and cleanings, which skew conversion drop-off statistics. To filter staff trajectories, the tracker matches active paths against employee-only zones (inventories, checkrooms) and filters out shopper IDs that exhibit continuous active dwell-time profiles exceeding 4 hours.
