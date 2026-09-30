# src/cache/ — YOUR code goes here

This folder is empty on purpose. This is the part you build by hand. Nothing else in the
app references it yet — you'll wire it in yourself.

## What to build (in order)

1. `ioredis.provider.ts`   — a Nest provider that connects an ioredis client from the REDIS_* env
                             vars and exposes it under a token (e.g. `REDIS_CLIENT`). Standalone
                             only (REDIS_CLUSTER=false), returns null on failure.
2. `ioredis-keyv.store.ts` — a KeyvStoreAdapter backed by that client (get/set/delete/clear).
3. `cache.module.ts`       — CacheModule.registerAsync using your store (remember: `stores: [...]`
                             plural), provides your CacheService, exports it. Make it @Global()
                             so any module can inject CacheService without re-importing.
4. `cache.service.ts`      — get / set / buildCacheKey / invalidateKey, plus an
                             @OnEvent('cache.updated') handler.

## Then wire it up

- Add your `CacheModule` to `src/app.module.ts` imports.
- In `DemoService.findAll`, check the cache first; on miss, hit the DB and set the cache.
- In `DemoService.create`, emit `cache.updated` so the next GET is a fresh miss.

## Your success test

```bash
curl localhost:3005/products      # slow (~400ms), logs "DB HIT"
curl localhost:3005/products      # FAST, NO "DB HIT" log  ← caching works
redis-cli keys '*'                # you can see your key
curl -XPOST localhost:3005/products -H 'content-type: application/json' -d '{"name":"x","price":1}'
curl localhost:3005/products      # slow again + "DB HIT"  ← invalidation works
```

Build each file from the annotated TODOs — try every method body yourself before checking
the reference solution. The point of this lab is to write the caching layer by hand, not to
copy it. See the root `README.md` and `STUDY-NOTES.md` for the concepts behind each step.
