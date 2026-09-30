
import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';

import { DemoService } from './demo.service';
import { Product } from './product.entity';

/**
 * SHELL — two endpoints:
 *   GET  /products        the slow read you'll cache
 *   POST /products        a write that SHOULD invalidate the cache once you wire that up
 *
 * Right now GET always takes ~400ms and logs "DB HIT". Your job: make the 2nd, 3rd, ...
 * GET fast and silent (a cache hit), and make POST bust the cache.
 */
@Controller('products')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Get()
  findAll(): Promise<Product[]> {
    return this.demo.findAll();
  }

  @Post()
  create(@Body() body: { name: string; price: number }): Promise<Product> {
    return this.demo.create(body.name, body.price);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Product | null> {
    return this.demo.findById(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name: string; price: number },
  ): Promise<Product> {
    return this.demo.update(id, body.name, body.price);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.demo.delete(id);
  }
}
