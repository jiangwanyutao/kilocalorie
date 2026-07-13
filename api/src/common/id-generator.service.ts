import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.module';
import { TableIdLen, TableName } from '../entities/base.entity';

@Injectable()
export class IdGeneratorService implements OnModuleInit {
  private readonly logger = new Logger('IdGenerator');

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly ds: DataSource,
  ) {}

  /**
   * 启动时把 Redis 计数器与 DB 最大 id 对齐（防 Redis 崩后重复 ID）
   * 后台异步执行 · 不阻塞 bootstrap（frp 长链路一张表回填可能 3-5s）
   */
  onModuleInit(): void {
    setImmediate(() => {
      this.runBackfill().catch((e: unknown) => {
        this.logger.warn(`backfill 整体失败：${(e as Error).message}`);
      });
    });
  }

  private async runBackfill(): Promise<void> {
    if (!this.ds.isInitialized) {
      this.logger.warn('DataSource 未初始化，跳过 ID 回填');
      return;
    }
    const started = Date.now();
    let ok = 0;
    let skipped = 0;
    for (const table of Object.keys(TableIdLen) as TableName[]) {
      try {
        const key = this.key(table);
        const [row] = await this.ds.query(
          `SELECT COALESCE(MAX(id::bigint), 0) AS max_id FROM "${table}"`,
        );
        const dbMax = Number(row?.max_id ?? 0);
        const redisMax = Number((await this.redis.get(key)) ?? 0);
        if (dbMax > redisMax) {
          await this.redis.set(key, dbMax);
          this.logger.log(`[backfill] ${table} redis=${redisMax} <- db=${dbMax}`);
        }
        ok++;
      } catch (e: unknown) {
        skipped++;
        this.logger.warn(`[backfill] skip ${table}: ${(e as Error).message}`);
      }
    }
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    this.logger.log(`ID backfill 完成 · ok=${ok} skipped=${skipped} · 用时 ${secs}s`);
  }

  /** 取一个新 ID · 左补零 · Redis 失败时降级用 DB MAX(id)+1 */
  async next(table: TableName): Promise<string> {
    const len = TableIdLen[table];
    try {
      const n = await this.redis.incr(this.key(table));
      return this.pad(n, len, table);
    } catch (e: unknown) {
      this.logger.warn(`Redis INCR 失败 · 降级 DB: ${(e as Error).message}`);
      return this.nextFromDb(table, len);
    }
  }

  /** 批量取 count 个新 ID · Redis 失败时降级 DB 顺序取 */
  async nextBatch(table: TableName, count: number): Promise<string[]> {
    if (count <= 0) return [];
    const len = TableIdLen[table];
    try {
      const end = await this.redis.incrby(this.key(table), count);
      const start = end - count + 1;
      const ids: string[] = [];
      for (let i = start; i <= end; i++) ids.push(this.pad(i, len, table));
      return ids;
    } catch (e: unknown) {
      this.logger.warn(`Redis INCRBY 失败 · 降级 DB: ${(e as Error).message}`);
      const [row] = await this.ds.query(
        `SELECT COALESCE(MAX(id::bigint), 0) AS max_id FROM "${table}"`,
      );
      const base = Number(row?.max_id ?? 0);
      this.redis.set(this.key(table), base + count).catch(() => undefined);
      const ids: string[] = [];
      for (let i = 1; i <= count; i++) ids.push(this.pad(base + i, len, table));
      return ids;
    }
  }

  /** 降级：从 DB 取 MAX(id::bigint)+1 · 有并发风险但 dev 可用 */
  private async nextFromDb(table: TableName, len: number): Promise<string> {
    const [row] = await this.ds.query(
      `SELECT COALESCE(MAX(id::bigint), 0) AS max_id FROM "${table}"`,
    );
    const next = Number(row?.max_id ?? 0) + 1;
    // 尝试异步回写 Redis（不 await · 不阻塞主流程）
    this.redis.set(this.key(table), next).catch(() => undefined);
    return this.pad(next, len, table);
  }

  private pad(n: number, len: number, table: string): string {
    const s = n.toString();
    if (s.length > len) {
      throw new Error(`[IdGenerator] ${table} 主键溢出 (值=${n} 长度=${len})`);
    }
    return s.padStart(len, '0');
  }

  private key(table: string): string {
    return `id:${table}`;
  }
}
