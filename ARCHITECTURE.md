# CivicPulse: Enterprise System Design & Capacity Planning

## 1. Executive Summary & Problem Definition
**CivicPulse** is a mission-critical civic telemetry and disaster response coordination platform. During steady-state operation, the system processes regular municipal complaints (potholes, street cleaning). During natural disasters (flash floods, major earthquakes, infrastructure ruptures), write traffic spikes by over **$200\times$**, while simultaneous read queries for live radar mapping surge by **$1000\times$**.

---

## 2. Back-of-the-Envelope Capacity Estimations

### Steady State vs. Major Disaster Scenario
* **Target Metropolitan Population**: $10,000,000$ citizens.
* **Active Disaster Event**: $5\%$ of population reports or checks incidents concurrently within a 1-hour peak ($500,000$ active users).

#### Write Throughput (Incident Ingestion & Upvoting)
* **Incident Reports**: $60,000$ reports submitted during the peak hour:
  $$\text{Average Write QPS} = \frac{60,000}{3600\text{ s}} \approx 17\text{ writes/sec}$$
  $$\text{Peak Ingestion QPS (Burst factor } 10\times\text{)} = 170\text{ writes/sec}$$
* **High-Concurrency Upvotes**: When an emergency issue trends virally, $200,000$ upvotes hit the platform in 10 minutes:
  $$\text{Sustained Upvote QPS} = \frac{200,000}{600\text{ s}} \approx 333\text{ upvotes/sec}$$
  $$\text{Peak Upvote QPS (Hot-Row contention window)} \ge 2,500\text{ upvotes/sec}$$

#### Read Throughput (Map Tile & Incident Stream)
* Each active user refreshes or polls live telemetry every 10 seconds:
  $$\text{Read QPS} = \frac{500,000\text{ users}}{10\text{ s}} = 50,000\text{ requests/sec}$$

#### Storage Projections (5-Year Retention)
* **Incident Metadata**: $2\text{ KB}$ per record $\times 2,000,000$ reports/year $\approx 4\text{ GB/year}$.
* **Image Media**: $2$ compressed photos ($800\text{ KB}$ each) per report:
  $$\text{Media Storage} = 2,000,000 \times 1.6\text{ MB} \approx 3.2\text{ TB/year}$$
* **5-Year Relational Footprint**: $\approx 20\text{ GB}$ structured PostGIS data (easily fits into RAM-cached index pools).
* **5-Year Blob Footprint**: $\approx 16\text{ TB}$ in AWS S3 with lifecycle transitions to Glacier Instant Retrieval after 90 days.

---

## 3. High-Concurrency Mitigation Strategies

### The Hot-Row Upvote Contention Problem
Executing naive relational updates:
```sql
UPDATE "Issue" SET "upvoteCount" = "upvoteCount" + 1 WHERE id = :target_id;
```
During a 2,500 req/sec surge creates row-exclusive locks on PostgreSQL. Worker threads block waiting for lock release, exhausting the database connection pool in seconds.

### The Solution: Redis Write-Behind Buffering
```
Client Upvote -> Redis Lua Script [ Deduplicate in Set + HINCRBY Buffer ] -> Return 200 OK
                                                                                 │
                                                                   Every 500ms Flush Worker
                                                                                 │
                                                                                 ▼
                                                                     Bulk Merge UPDATE to Postgres
```
1. Client requests execute an atomic Redis Lua script checking an in-memory set (`SADD issue:{id}:voters {userId}`).
2. If the user hasn't voted, the script increments `HINCRBY issue:upvote:buffer {id} 1` in sub-millisecond memory time.
3. A background task reads accumulated buffer counts every 500ms and executes a single batched SQL statement:
```sql
UPDATE "Issue" as i
SET "upvoteCount" = i."upvoteCount" + c.pending_votes
FROM (VALUES ($1::uuid, $2::int), ($3::uuid, $4::int)) as c(id, pending_votes)
WHERE i.id = c.id;
```
**Outcome**: Reduces database write operations from $2,500\text{ transactions/sec}$ to **$2\text{ bulk transactions/sec}$** ($99.92\%$ lock contention reduction).

---

## 4. Geospatial Indexing: GiST vs. SP-GiST

```
                 Earth Surface (Curved Ellipsoid EPSG:4326)
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
       PostGIS GEOMETRY                          PostGIS GEOGRAPHY
- Planar Euclidean space (flat)          - Great-circle geodesic distance
- Distorted distance near poles          - Accurate meter calculations
- Fast trigonometry                      - Slightly higher CPU cost
```

* **Selected Type**: `geography(Point, 4326)`.
* **Index Strategy**: Generalized Search Tree (**GiST**) using R-tree hierarchical bounding boxes.
* **Query Mechanics**:
  ```sql
  ST_DWithin(location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, 5000);
  ```
  GiST enables bounding box pre-filtering in $O(\log N)$ time, bypassing 99.8% of table rows before computing geodesic distance.

---

## 5. Transactional Outbox vs. Dual-Write Problem

| Failure Mode | Direct Queue Dispatch inside API | Transactional Outbox Pattern |
| :--- | :--- | :--- |
| **DB Commits, Queue Crashes** | ❌ Data saved, but job lost forever (AI tagging never happens) | ✅ Outbox record exists in DB; poller retries queueing |
| **Queue Accepts, DB Rolls Back** | ❌ Ghost job processes an issue that was never created | ✅ Outbox record rolls back with transaction; zero ghost jobs |
| **Worker Crashes Mid-Job** | ❌ Job dropped unless complex message ACK is managed | ✅ Outbox status remains `PENDING`; auto-recovered by watchdog |

---

## 6. Disaster Recovery & Reliability SLA

* **Target Availability**: $99.99\%$ (Four Nines $\le 52$ minutes downtime/year).
* **Multi-AZ Replication**: Synchronous PostgreSQL read-replicas in alternate availability zones with automated health failover via PgBouncer.
* **Edge Survivability**: Even if the primary database is momentarily unreachable, the client PWA caches incident reports in **IndexedDB** locally, automatically re-synchronizing when health checks resume.
