import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';
import { Product } from './product.entity';

/**
 * SHELL — registers the demo target. You won't need to change this until you want the
 * controller/service to actually use your CacheService (then inject it here).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
