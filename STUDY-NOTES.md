# Caching — Study Notes

My notes on caching for backend / system-design, written while building this lab. Each concept
is linked to where it actually shows up in the code, so the theory isn't abstract.

---

## Why cache at all

Reading from Postgres (disk) is ~50 ms; reading from Redis (memory) is ~1 ms. Memory sits closer
to the CPU and skips disk entirely. Caching trades a little complexity (staleness, invalidation)
for a large win in latency and database load.

**Reach for a cache when:**
- Read-heavy workload (the same data read far more than it's written)
- Expensive queries (joins, aggregations, computed feeds)
- High database CPU from repeated identical reads
- Tight latency targets (sub-10 ms) the database can't hit

**Don't cache everything.** Cache what is read often, changes rarely, and is expensive to
produce. A well-indexed query is sometimes enough.

---

## Where caching can live

| Layer | Example | Use when |
|---|---|---|
| **External cache** | Redis, Memcached | default for app-level caching; shared across servers |
| **CDN** | Cloudflare, Fastly | static media / public responses served near the user |
| **Client-side** | browser cache, mobile storage | avoid network calls entirely; limited backend control |
| **In-process** | a `Map` inside the app | tiny, hot, rarely-changing data (config, flags, hot keys) |

This lab is the **external cache** case (Redis), with an **in-process** fallback when Redis is
down, and an in-process `Map` used for single-flight coalescing.

---

## Cache patterns (the important distinctions)

### Cache-aside (lazy loading) — what this lab uses
The **application** owns the logic: check cache → on miss, read DB, populate cache, return.
Only requested data is cached, so the cache stays lean. Downside: a miss pays extra latency.
**Default answer for app-level caching.**
→ `src/demo/demo.service.ts` `findAll()` / `findById()`.

### Read-through
The **cache** owns the logic: the app only talks to the cache; on a miss the *cache* fetches
from the DB. CDNs work this way. Less common for app-level Redis.
**Trap:** cache-aside vs read-through differ by *who* fetches on a miss — the app (aside) vs the
cache (through).

### Write-through
App writes to the cache; the cache **synchronously** writes to the DB before returning. Strong
read freshness, slower writes, needs a store plugin. Still has the dual-write consistency risk.

### Write-behind (write-back)
App writes to the cache; the cache flushes to the DB **asynchronously**. Very fast writes, but
data loss if the cache crashes before flushing. Good for metrics/analytics.

**One-liner to remember:** aside = app fetches on miss · read-through = cache fetches on miss ·
write-through = sync DB write · write-behind = async DB write.

---

## Eviction policies

Caches have limited memory and must evict when full.

| Policy | Evicts | Good for |
|---|---|---|
| **LRU** (Least Recently Used) | item unused for longest | general default; recent data likely reused |
| **LFU** (Least Frequently Used) | item accessed least | consistently popular keys (trending content) |
| **FIFO** | oldest inserted | rarely used; ignores access patterns |
| **TTL** | expired keys (time-based) | freshness; combined with LRU/LFU |

**TTL is not really eviction** — it's expiry. This lab uses TTL (`CACHE_DEFAULT_TTL=60`), so keys
auto-expire and you can watch the countdown in `redis-cli TTL <key>`.
→ set via the `'PX', ttl` (milliseconds) argument in `src/cache/ioredis-keyv.store.ts`.

---

## Common failure modes (what interviews actually test)

### 1. Cache stampede (thundering herd)
A hot key expires and N concurrent requests all miss at once → all hit the DB together → spike.
**Fixes:** request coalescing / single-flight (one request rebuilds, others wait) — most
effective; and cache warming (refresh before expiry, TTL-based only).
→ Solved here with a single-flight promise in `demo.service.ts` (`inFlightAll`). Measured: 50
concurrent cold requests dropped from **50 DB queries to 1**.

*Limitation:* the single-flight `Map` is per-process. Across N servers you'd get N queries on a
cold key; true cluster-wide single-flight needs a distributed lock (Redis `SET NX PX`).

### 2. Cache consistency (stale data)
Reads come from cache but writes go to the DB first → a window where the cache is stale.
**Fixes:** invalidate on write (delete the key), short TTL, or accept eventual consistency
(fine for feeds/metrics).
→ `@OnEvent('cache.updated')` in `cache.service.ts` deletes the affected keys after every write.
The subtle part: one product lives in **two** keys (the list and `product:{id}`), so an update
must invalidate **both**.

### 3. Hot keys
One key (e.g. a celebrity profile) gets a disproportionate share of traffic and overloads a
single Redis node/shard even at a high hit rate.
**Fixes:** replicate the key across nodes, add a local in-process cache for the hottest values,
rate-limit abusive patterns.

---

## Failure handling: Redis is down

A cache should be an optimization, not a single point of failure. Here, the Redis provider
returns `null` if it can't connect, and the cache module falls back to an **in-memory** store so
the app keeps serving (from the database) instead of crashing.
→ `ioredis.provider.ts` (null on failure) + `cache.module.ts` (`if (!client) return { ttl }`).

---

## How I'd introduce caching in a system-design interview

1. **Name the bottleneck** — "profile reads hit the DB 500×/s at 30 ms each; that's the ceiling."
2. **Decide what to cache** — read-often, change-rarely, expensive. Design the key (`user:{id}:profile`).
3. **Pick a pattern** — cache-aside by default; write-through only if reads must be perfectly fresh.
4. **Set eviction** — LRU + a TTL; invalidate on write for correctness.
5. **Address failure modes** — stampede (coalescing), consistency (invalidate on write), Redis-down (fallback). Pick the one or two relevant to the design.

---

## Key takeaways

- The hard part of caching is **not** reading — it's **invalidation** and **failure modes**.
- Cache-aside is the sensible default; know exactly how it differs from read-through.
- A single expired hot key can take down a database — single-flight is the cheapest defense.
- Never let the cache be a hard dependency; degrade to the source of truth.
