import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT) || 3005;
  await app.listen(port);
  new Logger('Bootstrap').log(`redis-cache-lab listening on http://localhost:${port}`);
}
bootstrap();
