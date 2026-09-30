import { Inject, Injectable } from "@nestjs/common";
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { OnEvent } from '@nestjs/event-emitter';
import type { Cache } from 'cache-manager';
const DEFAULT_TTL_MS = 60 * 1000; // 60 seconds
@Injectable()
export class CacheService {
    constructor(@Inject(CACHE_MANAGER) private readonly cache:Cache) {}

    async get<T>(key:string):Promise<T | undefined> {
        if (!key) {
            return undefined;
        }
        const value = await this.cache.get<T>(key);
         console.log(`Cache GET key=${key} ${value == null ? 'miss' : 'hit'}`);
        return value;
    }
    async set<T>(key:string, value:T, ttl?:number):Promise<void> {
        if (!key) {
            return;
        }
        const ttlMs = ttl ?? DEFAULT_TTL_MS;
        await this.cache.set<T>(key, value, ttlMs );
         console.log(`Cache SET key=${key} ttl=${ttl ?? 'default'}`);
    }
    async invalidateKey(key:string):Promise<void> {
        if (!key) {
            return;
        }
        await this.cache.del(key);
         console.log(`Cache DEL key=${key}`);
    }
    buildCacheKey(resourcePath: string, queryParams?: Record<string, string | number>):string{
        if(!queryParams || Object.keys(queryParams).length === 0){
            return resourcePath;
        }
        const queryString = Object.entries(queryParams)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
        return `${resourcePath}?${queryString}`;
    }
    @OnEvent('cache.updated')
    async handleCacheUpdateEvent(payload: { key: string; value: any; ttl?: number }) {
        if(payload==null){
            console.warn('[cache] cache.updated event received with null payload, ignoring');
            return;
        }
        await this.invalidateKey(payload.key);
    }
}