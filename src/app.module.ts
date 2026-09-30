import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DemoModule } from './demo/demo.module';
import { CacheRedisModule } from './cache/cache.module';

/**
 * SHELL — provided for you. You normally won't touch this file except to add ONE line:
 * import your CacheModule (the thing you're going to build in src/cache/) here once it exists.
 *
 * What's already wired:
 *  - ConfigModule       reads .env, available everywhere
 *  - EventEmitterModule enables @OnEvent('cache.updated') — the invalidation channel
 *  - TypeOrmModule      connects to the local Postgres from docker-compose (host 5432),
 *                       database `cache_lab`. synchronize:true auto-creates the demo table,
 *                       so you don't need migrations for this lab.
 *  - DemoModule         a deliberately SLOW read endpoint — your caching TARGET.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      autoLoadEntities: true,
      synchronize: true, // OK for a throwaway lab DB. NEVER use synchronize in production.
    }),
    DemoModule,
    CacheRedisModule,
    // TODO (you): import your CacheModule here once you've built src/cache/.
  ],
})
export class AppModule {}
