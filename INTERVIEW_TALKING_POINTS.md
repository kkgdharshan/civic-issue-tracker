# CivicPulse: FAANG Interview Defense & Architectural Talking Points

Use this guide during Staff / Lead Full-Stack system design and technical portfolio review rounds.

---

## 🎙️ The 90-Second Elevator Pitch

> *"CivicPulse is a high-concurrency, real-time civic issue coordination and disaster response platform. When a natural disaster strikes an urban center of 10 million citizens, traffic surges by two orders of magnitude while network conditions degrade. 
> 
> I designed CivicPulse specifically to solve three enterprise-grade distributed systems bottlenecks:
> 1. **Zero Data Loss under Disconnected Environments**: Through an offline-first PWA pipeline with client-side canvas EXIF stripping and IndexedDB binary queues that auto-reconcile using idempotency keys.
> 2. **Sub-Millisecond UI Response under Hot-Row Contention**: Instead of hammering PostgreSQL with row-level locks when 50,000 citizens upvote the same trending disaster incident, I implemented a two-tier Redis write-behind buffer that drains into PostgreSQL via micro-batches, paired with TanStack Query v5 optimistic rollbacks.
> 3. **Main-Thread Frame Rate Preservation**: By offloading spatial R-tree calculations and clustering to a dedicated Web Worker and windowing the incident stream with `@tanstack/react-virtual`, the client sustains 60 FPS even with over 100,000 coordinate points."*

---

## 🎯 Deep-Dive Defense Questions & Model Answers

### Q1: "Why did you choose PostGIS `geography` over `geometry`?"
**Staff Answer:**
> *"PostGIS `geometry` operates on a planar, Cartesian coordinate system where distance is measured in Euclidean degrees. At high or mid-latitudes (like San Francisco at $37.7^\circ\text{N}$ or London at $51.5^\circ\text{N}$), degrees of longitude shrink, distorting distance calculations by up to 30%.
> 
> `geography(Point, 4326)` calculates great-circle distance on the WGS84 curved ellipsoid in true meters. By combining `geography` with a **GiST (Generalized Search Tree)** index, `ST_DWithin` achieves sub-millisecond proximity queries ($<5\text{ms}$) by pre-filtering bounding boxes before calculating geodesic spherical trigonometry."*

---

### Q2: "How do you prevent the 'Dual-Write' bug between the database and background queue?"
**Staff Answer:**
> *"Directly publishing jobs to BullMQ inside an HTTP route handler introduces dual-write race conditions: if BullMQ accepts the job but the database transaction subsequently aborts, a ghost job executes on non-existent records; conversely, if the DB commits but the queue node is down, the job is permanently lost.
> 
> I resolved this by applying the **Transactional Outbox Pattern**. In a single ACID PostgreSQL transaction, we insert both the `Issue` and an `OutboxEvent` record. A dedicated processor or Change Data Capture (CDC) stream reads committed outbox entries and guarantees at-least-once dispatch to BullMQ with exponential backoff and dead-letter queues (DLQ)."*

---

### Q3: "What happens when 50,000 people click 'Upvote' on the same gas leak in 5 seconds?"
**Staff Answer:**
> *"In a naive implementation, executing `UPDATE "Issue" SET "upvoteCount" = "upvoteCount" + 1 WHERE id = :id` generates row-exclusive lock contention on PostgreSQL, which cascades into connection pool exhaustion.
> 
> To mitigate this, CivicPulse implements a **Redis Write-Behind Buffer**:
> 1. The client upvote executes an atomic Lua script in Redis that checks an in-memory set (`SADD issue:{id}:voters {userId}`) to enforce one vote per user in $O(1)$ time.
> 2. The pending increment is buffered in Redis using `HINCRBY issue:upvote:buffer {id} 1`.
> 3. A background task runs every $500\text{ ms}$, takes the pending counts, and performs a single bulk SQL merge into PostgreSQL.
> 4. On the frontend, **TanStack Query v5** executes an optimistic UI mutation immediately, capturing a rollback snapshot in case the network fails."*

---

### Q4: "How does the client upload 10MB images without choking the API servers?"
**Staff Answer:**
> *"Proxying binary image streams through Node.js consumes valuable event loop single-threaded bandwidth and exhausts server RAM buffers.
> 
> Instead, CivicPulse uses **direct-to-S3 presigned URLs**:
> 1. The browser first resizes camera photos (often 48MP) to 1080p using an HTML5 Canvas worker, stripping EXIF geolocation metadata for user privacy and reducing file size by $\sim 92\%$.
> 2. The client requests a short-lived ($15\text{ min}$) presigned PUT URL from `/api/uploads/presigned-url` with cryptographic size and MIME-type constraints.
> 3. The client uploads the binary blob directly from the browser to AWS S3, bypassing our application compute tier entirely."*

---

### Q5: "How does the map not freeze when rendering 50,000 incident points?"
**Staff Answer:**
> *"Rendering tens of thousands of DOM markers degrades WebGL and DOM performance to $<10\text{ FPS}$.
> 
> I mitigated this on two levels:
> 1. **Off-Thread Web Worker Clustering**: The raw GeoJSON features are passed to a background Web Worker (`workers/cluster.worker.ts`) running a spatial R-tree index. Clustering and viewport bounding-box calculations execute completely off the main thread.
> 2. **DOM Windowing**: The incident feed uses `@tanstack/react-virtual` to measure and render only the visible viewport elements ($\sim 15\text{ items}$), maintaining a constant $O(1)$ DOM footprint regardless of list depth."*
