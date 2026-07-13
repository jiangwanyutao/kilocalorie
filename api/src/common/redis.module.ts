import { Global, Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Redis as RedisType } from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: async (cfg: ConfigService): Promise<RedisType> => {
        const logger = new Logger('RedisClient');
        const url = cfg.getOrThrow<string>('REDIS_URL');
        const db = Number(cfg.get<number>('REDIS_DB') ?? 5);
        const client = new Redis(url, {
          db,
          lazyConnect: false,
          // frp 转发长链路：不限单请求重试次数（配 retryStrategy 兜底）
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
          keyPrefix: 'qk:',
          connectTimeout: 20_000,
          commandTimeout: 2_500,
          keepAlive: 30_000,
          retryStrategy: (times: number) => Math.min(times * 500, 5_000),
          reconnectOnError: () => true,
        });
        client.on('error', (err) => logger.error(`redis error: ${err.message}`));
        client.on('connect', () => logger.log(`redis connected db=${db}`));
        // frp idle timeout 应用层心跳：每 20s PING 防被踢（3s 太密会跟正常操作抢连接）
        const heartbeat = setInterval(() => {
          client.ping().catch(() => {});
        }, 20_000);
        heartbeat.unref?.();
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
