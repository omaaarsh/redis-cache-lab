# Redis Cache Lab

A hands-on NestJS project where I built a **Redis caching layer from scratch** — no
`CacheModule.register()` shortcut — to actually understand cache-aside, invalidation, and
cache-stampede protection instead of just wiring a library.

Every layer is built by hand: the Redis client, a Keyv store adapter, the cache-manager module,
a cache service with event-driven invalidation, and single-flight stampede protection.
Then I **measured** it.

## Results (measured, not claimed)

| Scenario | Before | After | Win |
|---|---|---|---|
| Repeated read (`GET /products`) | 466 ms (Postgres) | 1.7 ms (Redis) | **~260× faster** |
| 50 concurrent reads, cold cache | 50 DB queries | **1 DB query** | stampede stopped (49 requests coalesced) |
| Write → next read | serves stale | serves fresh | invalidation on write, across list + item keys |

## What it demonstrates

- **Cache-aside (lazy loading)** — check cache → on miss, read DB, populate, return.
- **Cache invalidation on writes** — an event (`cache.updated`) busts the relevant keys so the next read is fresh. Handles the *two-copies* problem (a product is cached in both the list key and its own `product:{id}` key, so writes invalidate both).
- **Cache-stampede / thundering-herd protection** — single-flight request coalescing: when many requests miss a cold key at once, only one rebuilds it and the rest share the result.
- **Graceful degradation** — if Redis is down, the app falls back to an in-memory store and keeps serving.
- **TTL-based expiry** — keys auto-expire (`CACHE_DEFAULT_TTL`), visible counting down in Redis.

## Architecture

```
Client → NestJS (DemoService, cache-aside)
                 │
                 ├─ hit  → Redis (1 ms)
                 └─ miss → Postgres (~400 ms) → write to Redis → return

Write (POST/PUT/DELETE) → emit "cache.updated" → CacheService invalidates keys
```

The caching layer (`src/cache/`), built by hand, is a chain of small pieces:

```
ioredis.provider.ts    raw Redis client (null-safe: returns null if Redis is down)
        ↓
ioredis-keyv.store.ts  Keyv adapter — get / set / delete / clear over Redis
        ↓
cache.module.ts        cache-manager registerAsync, wired via DI (extraProviders)
        ↓
cache.service.ts       get / set / invalidate + @OnEvent('cache.updated')
        ↓
demo.service.ts        cache-aside CRUD + single-flight coalescing
```

## Tech

NestJS 11 · TypeScript · ioredis · cache-manager v7 · Keyv · TypeORM · PostgreSQL · Docker Compose

## Run it

Requires Docker and Node 20+.

```bash
git clone <your-repo-url> redis-cache-lab
cd redis-cache-lab
cp .env.example .env
npm install
npm run infra:up      # starts Redis + Postgres via docker-compose (DB auto-created)
npm run start:dev     # http://localhost:3005
```

### See the cache work

```bash
# seed a few products
curl -s -XPOST localhost:3005/products -H 'content-type: application/json' -d '{"name":"Keyboard","price":45}'

# 1st read: slow, logs "DB HIT"
curl -s -o /dev/null -w "%{time_total}s\n" localhost:3005/products
# 2nd read: fast, served from Redis, no "DB HIT"
curl -s -o /dev/null -w "%{time_total}s\n" localhost:3005/products

# a write busts the cache → next read is slow again
curl -s -XPOST localhost:3005/products -H 'content-type: application/json' -d '{"name":"Mouse","price":25}'
curl -s -o /dev/null -w "%{time_total}s\n" localhost:3005/products   # slow again
```

### Prove stampede protection

```bash
# cold cache, then 50 requests at once → check the logs: exactly ONE "DB HIT"
for i in $(seq 1 50); do curl -s -o /dev/null localhost:3005/products & done; wait
```

## Endpoints

| Method | Route | Notes |
|---|---|---|
| `GET` | `/products` | cached list (cache-aside + single-flight) |
| `GET` | `/products/:id` | cached per-item (`product:{id}`) |
| `POST` | `/products` | create → invalidates list |
| `PUT` | `/products/:id` | update → invalidates list **and** item |
| `DELETE` | `/products/:id` | delete → invalidates list **and** item |

## Learn the concepts

See **[STUDY-NOTES.md](./STUDY-NOTES.md)** for the caching theory behind each piece — cache
patterns (cache-aside vs read-through vs write-through vs write-behind), eviction policies,
and the classic failure modes (stampede, consistency, hot keys) — mapped to where each shows
up in this code.

---

Built as a learning project to go deeper than "just add a cache."
