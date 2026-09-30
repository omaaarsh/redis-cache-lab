
import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT'; // token as a constant (cleaner than a raw string)

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: async (config: ConfigService): Promise<Redis | null> => {
    // TODO 1: read REDIS_HOST and REDIS_PORT from `config` (use config.get(...))
    const host = config.get<string>('REDIS_HOST');
    const port = config.get<number>('REDIS_PORT');

    // TODO 2: create `new Redis({ host, port, lazyConnect: true })`
    //         then call client.connect() — if it throws, return null
    const client = new Redis({ host, port, lazyConnect: true });
    try {
      await client.connect();
    } catch (error) {
      console.warn('[cache] Redis unavailable, running without cache:', (error as Error).message);
      client.disconnect(); // ensure we clean up the client if connection fails
      return null;
    }

    // TODO 3: return the client
    return client;
  },
};