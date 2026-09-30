import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Product } from './product.entity';
import { CacheService } from 'src/cache/cache.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * SHELL — your caching TARGET.
 *
 * `findAll` is deliberately SLOW (400ms) and logs every time it hits the DB. That log line is
 * your instrument: once you add caching, a cache HIT should NOT print "DB HIT". If it still
 * prints on every request, your cache isn't working. Do not add caching in here — do it in
 * your own layer (src/cache/) so the target stays honest.
 */
@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    private readonly cacheService: CacheService, 
    private readonly events: EventEmitter2
  ) {}

  // Single-flight: holds the in-progress DB fetch so concurrent callers share ONE query
  // instead of each stampeding Postgres when the cache is cold.
  private inFlightAll: Promise<Product[]> | null = null;

  async findAll(): Promise<Product[]> {
    const cached = await this.cacheService.get<Product[]>('products');
    if (cached) {
      this.logger.warn('CACHE HIT — findAll returned from cache');
      return cached;
    }

    // Someone is already rebuilding this key — wait for their result, don't start another query.
    if (this.inFlightAll) {
      this.logger.warn('COALESCED — waiting on in-flight findAll');
      return this.inFlightAll;
    }

    // I'm the first miss: start the fetch, publish the promise so others can join.
    this.inFlightAll = this.fetchAndCacheAll();
    try {
      return await this.inFlightAll;
    } finally {
      this.inFlightAll = null; // clear so the NEXT cold miss can fetch again
    }
  }

  private async fetchAndCacheAll(): Promise<Product[]> {
    await new Promise((r) => setTimeout(r, 400)); // simulate an expensive query
    this.logger.warn('DB HIT — findAll went to Postgres');
    const products = await this.products.find({ order: { createdAt: 'DESC' } });
    await this.cacheService.set('products', products);
    return products;
  }

  async create(name: string, price: number): Promise<Product> {
    const saved = await this.products.save(this.products.create({ name, price }));
    this.logger.log(`Created product ${saved.id} — remember: this SHOULD invalidate your cache`);
    this.events.emit('cache.updated', { key: 'products' }); // notify cache to invalidate
    return saved;
  }
  async update(id: string, name: string, price: number): Promise<Product> {
    const product = await this.products.findOneBy({ id });
    if (!product) {
      throw new Error(`Product with id ${id} not found`);
    }
    product.name = name;
    product.price = price;
    const saved = await this.products.save(product);
    this.logger.log(`Updated product ${saved.id} — remember: this SHOULD invalidate your cache`);
    this.events.emit('cache.updated', { key: 'products' }); // notify cache to invalidate
    this.events.emit('cache.updated', { key: `product:${id}` }); // notify cache to invalidate individual product
    return saved;
  }

  async delete(id: string): Promise<void> {
    const product = await this.products.findOneBy({ id });
    if (!product) {
      throw new Error(`Product with id ${id} not found`);
    }
    await this.products.remove(product);
    this.logger.log(`Deleted product ${id} — remember: this SHOULD invalidate your cache`);
    this.events.emit('cache.updated', { key: `product:${id}` }); // notify cache to invalidate individual product
    this.events.emit('cache.updated', { key: 'products' }); // notify cache to invalidate
  }
  async findById(id: string): Promise<Product | null> {
    const cached = await this.cacheService.get<Product>(`product:${id}`);
    if (cached) {
      this.logger.warn(`CACHE HIT — findById(${id}) returned from cache`);
      return cached;
    }
    await new Promise((r) => setTimeout(r, 400)); // simulate an expensive query
    this.logger.warn(`DB HIT — findById(${id}) went to Postgres`);
    const product = await this.products.findOneBy({ id });
    if (product) {
      await this.cacheService.set(`product:${id}`, product);
    }
    return product;
  }
}
