
import { Global, Module } from '@nestjs/common';
import { CacheModule, CacheModuleOptions } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Keyv } from 'keyv';
import type Redis from 'ioredis';

import { REDIS_CLIENT, redisProvider } from './ioredis.provider';
import { createIoredisKeyvStore } from './ioredis-keyv.store';
import { CacheService } from './cache.service';

@Global() // any module can inject CacheService without re-importing
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      // TODO 1: inject BOTH the config AND your redis client token
      inject: [ConfigService, REDIS_CLIENT],

      useFactory: (config: ConfigService, client: Redis | null):CacheModuleOptions => {
        const ttl = config.get<number>('CACHE_DEFAULT_TTL', 60) * 1000; // .env is seconds → ms

        // TODO 2: if client is null (Redis down), return { ttl } with NO store
        //         → cache-manager falls back to in-memory, app still runs
        if (!client) {
          console.warn('[cache] Redis unavailable, using in-memory cache');
          return { ttl };
        }
        // TODO 3: Redis is up → wrap your store in a Keyv, return it under `stores` (PLURAL)
        //         const store = createIoredisKeyvStore(client);
        //         const keyv = new Keyv({ store });
        //         return { stores: [keyv], ttl };
        const store = createIoredisKeyvStore(client);
        const keyv = new Keyv({ store });
        return { stores: [keyv], ttl };
      },
      // registerAsync builds its OWN inner injector; extraProviders makes redisProvider
      // (REDIS_CLIENT) visible to the useFactory above. Without this, inject:[…REDIS_CLIENT]
      // can't be resolved.
      extraProviders: [redisProvider],
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheRedisModule {}