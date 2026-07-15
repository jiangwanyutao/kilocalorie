import { Global, Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger('MinioService');
  private client!: MinioClient;
  private bucket!: string;

  constructor(private readonly cfg: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.bucket = this.cfg.getOrThrow<string>('MINIO_BUCKET_PHOTO');
    this.client = new MinioClient({
      endPoint: this.cfg.getOrThrow<string>('MINIO_ENDPOINT'),
      port: Number(this.cfg.get<number>('MINIO_PORT') ?? 19000),
      useSSL: String(this.cfg.get<string>('MINIO_USE_SSL') ?? 'false') === 'true',
      accessKey: this.cfg.getOrThrow<string>('MINIO_ACCESS_KEY'),
      secretKey: this.cfg.getOrThrow<string>('MINIO_SECRET_KEY'),
    });

    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`bucket 已创建：${this.bucket}`);
      } else {
        this.logger.log(`bucket 就绪：${this.bucket}`);
      }
    } catch (e) {
      this.logger.error(`MinIO 初始化失败：${(e as Error).message}`);
    }
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.putObject(this.bucket, key, body, body.length, {
      'Content-Type': contentType,
    });
  }

  async removeObject(key: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, key);
    } catch (e) {
      this.logger.warn(`删除对象失败 ${key}: ${(e as Error).message}`);
    }
  }

  async presignedGetUrl(key: string, ttlSec: number = 7 * 24 * 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, ttlSec);
  }

  /** 拉对象到 Buffer · 用于小文件 API 中转（头像 · 缩略图） */
  async getObjectBuffer(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}

@Global()
@Module({
  providers: [MinioService],
  exports: [MinioService],
})
export class MinioModule {}
