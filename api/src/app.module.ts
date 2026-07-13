import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv } from './config/env.validation';
import { RedisModule } from './common/redis.module';
import { IdGeneratorModule } from './common/id-generator.module';
import { MailModule } from './common/mail.module';
import { HealthController } from './common/health.controller';
import { ALL_ENTITIES } from './entities';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { MealModule } from './modules/meal/meal.module';
import { FoodModule } from './modules/food/food.module';
import { WaterModule } from './modules/water/water.module';
import { BodyModule } from './modules/body/body.module';
import { ExerciseModule } from './modules/exercise/exercise.module';
import { VisionModule } from './modules/vision/vision.module';
import { AiModule } from './modules/ai/ai.module';
import { FastingModule } from './modules/fasting/fasting.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        url: cfg.getOrThrow<string>('DATABASE_URL'),
        entities: ALL_ENTITIES,
        synchronize: false,
        logging: cfg.get<string>('NODE_ENV') === 'development' ? ['warn', 'error'] : ['error'],
        extra: {
          max: Number(cfg.get('DB_POOL_MAX') ?? 10),
          idleTimeoutMillis: 30_000,
        },
      }),
    }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
    RedisModule,
    IdGeneratorModule,
    MailModule,
    AuthModule,
    UserModule,
    MealModule,
    FoodModule,
    WaterModule,
    BodyModule,
    ExerciseModule,
    VisionModule,
    AiModule,
    FastingModule,
    KnowledgeModule,
    HealthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
