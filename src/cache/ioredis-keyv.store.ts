import type { KeyvStoreAdapter, StoredData } from 'keyv';
import type Redis from 'ioredis';

export function createIoredisKeyvStore(client: Redis): KeyvStoreAdapter {
  return {
    async get<Value>(key: string): Promise<StoredData<Value> | undefined> {
      // TODO: client.get(key). If null → return undefined. Else JSON.parse it.
      const data = await client.get(key);
      if (data === null) {
        return undefined;
      }
      return JSON.parse(data);
    },

    async set(key: string, value: string, ttl?: number): Promise<void> {
      // TODO: if ttl given → client.set(key, value, 'PX', ttl); else client.set(key, value)
      // (value already arrives JSON-stringified from cache-manager — just store it)
        if (ttl) {
          await client.set(key, value, 'PX', ttl);
        } else {
          await client.set(key, value);
        }
    },

    async delete(key: string): Promise<boolean> {
      // TODO: const n = await client.del(key); return n > 0;
      const n = await client.del(key);
        return n > 0;
    },

    async clear(): Promise<void> {
      // TODO: await client.flushdb();
        await client.flushdb();
    },

    // keyv also wants these — you can stub them:
    opts: {},
    on() { return this; },
  };
}