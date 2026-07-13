import { Controller, Get, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.module';

@Controller('health')
export class HealthController {
  constructor(
    private readonly ds: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  async health() {
    const db = await this.ping(() => this.ds.query('SELECT 1'));
    const redis = await this.ping(() => this.redis.ping());
    const status = db === 'ok' && redis === 'ok' ? 'ok' : 'degraded';
    return {
      status,
      db,
      redis,
      version: process.env.npm_package_version ?? '0.1.0',
      time: new Date().toISOString(),
    };
  }

  private async ping(fn: () => Promise<unknown>): Promise<string> {
    try {
      await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout 5s')), 5_000),
        ),
      ]);
      return 'ok';
    } catch (e) {
      return `fail: ${(e as Error).message}`;
    }
  }
}
