import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, MinLength, validateSync } from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvSchema {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsOptional()
  @IsInt()
  PORT: number = 7100;

  @IsString()
  DATABASE_URL!: string;

  @IsOptional()
  @IsInt()
  DB_POOL_MAX: number = 10;

  @IsString()
  REDIS_URL!: string;

  @IsOptional()
  @IsInt()
  REDIS_DB: number = 5;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET 至少 32 字节' })
  JWT_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_TTL: string = '30m';

  @IsOptional()
  @IsString()
  JWT_REFRESH_TTL: string = '30d';

  @IsString()
  MINIO_ENDPOINT!: string;

  @IsOptional()
  @IsInt()
  MINIO_PORT: number = 19000;

  @IsString()
  MINIO_ACCESS_KEY!: string;

  @IsString()
  MINIO_SECRET_KEY!: string;

  @IsOptional()
  @IsString()
  MINIO_USE_SSL: string = 'false';

  @IsString()
  MINIO_BUCKET_PHOTO: string = 'qianka-photo';

  @IsOptional()
  @IsString()
  MAIL_HOST: string = 'smtp.qq.com';

  @IsOptional()
  @IsInt()
  MAIL_PORT: number = 465;

  @IsOptional()
  @IsString()
  MAIL_USER?: string;

  @IsOptional()
  @IsString()
  MAIL_PASS?: string;

  @IsOptional()
  @IsString()
  MAIL_FROM?: string;

  @IsOptional()
  @IsString()
  DEEPSEEK_API_KEY?: string;

  @IsOptional()
  @IsString()
  DEEPSEEK_BASE_URL: string = 'https://api.deepseek.com';

  @IsOptional()
  @IsString()
  DASHSCOPE_API_KEY?: string;

  @IsOptional()
  @IsString()
  DASHSCOPE_BASE_URL: string = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  APP_ORIGIN: string = 'http://localhost:7110';

  @IsOptional()
  @IsString()
  CORS_ORIGIN: string = 'http://localhost:7110';
}

export function validateEnv(config: Record<string, unknown>) {
  const instance = plainToInstance(EnvSchema, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(instance, {
    skipMissingProperties: false,
    forbidUnknownValues: false,
  });
  if (errors.length > 0) {
    const msg = errors.map((e) => Object.values(e.constraints ?? {}).join(';')).join(' | ');
    throw new Error(`环境变量校验失败: ${msg}`);
  }
  return instance;
}
